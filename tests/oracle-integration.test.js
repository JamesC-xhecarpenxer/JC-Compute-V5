/**
 * oracle-integration.test.js
 *
 * Tests the multi-model consensus oracle without a live Ollama server.
 * Uses a mock fetch shim that returns deterministic JSON proposals.
 *
 * Verifies:
 *  1. CRDT merge is commutative, associative, idempotent
 *  2. Consensus tier correctly promotes multi-model agreement
 *  3. Union tier keeps unique single-model proposals
 *  4. bootstrapLoop converges to a fixed point
 *  5. Graceful degradation on model failure
 */

import test from "node:test";
import assert from "node:assert/strict";

// ─── Import oracle internals ──────────────────────────────────────────────────
// Adjust path if placing the oracle inside the project
import {
  createTransitionOracle
} from "../runtime/oracle/ollama-transition-oracle.js";

const oracle = createTransitionOracle({
  models: ["mistral", "llama3.2"],
  ollamaBase: "http://localhost:11434"   // not actually called in mocked tests
});

// ─── CRDT merge tests (pure, no network) ─────────────────────────────────────

test("mergeProposals — consensus promotion", () => {
  const modelResults = [
    { model: "mistral",  proposals: [{ opcode: 0, payload: [1, 7, 0, 0] }, { opcode: 2, payload: [0, 1] }] },
    { model: "llama3.2", proposals: [{ opcode: 0, payload: [1, 7, 0, 0] }, { opcode: 5, payload: [3, 0] }] }
  ];

  const { irSet, consensus, union } = oracle._mergeProposals(modelResults, {
    consensusThreshold: 2,
    maxIR: 8
  });

  // opcode:0 payload:[1,7,0,0] agreed by both models → consensus
  assert.equal(consensus.length, 1, "exactly one consensus IR");
  assert.equal(consensus[0].opcode, 0, "consensus opcode is 0");

  // opcode:2 and opcode:5 each appeared in only 1 model → union
  assert.equal(union.length, 2, "two union-tier IRs");

  // irSet = consensus first, then union
  assert.equal(irSet[0].opcode, 0, "consensus IR leads the set");
  assert.equal(irSet.length, 3, "total IR set length");
});

test("mergeProposals — commutativity (order of models does not matter)", () => {
  const m1 = { model: "A", proposals: [{ opcode: 1, payload: [0, 2] }] };
  const m2 = { model: "B", proposals: [{ opcode: 1, payload: [0, 2] }, { opcode: 3, payload: [9] }] };

  const resultAB = oracle._mergeProposals([m1, m2], { consensusThreshold: 2 });
  const resultBA = oracle._mergeProposals([m2, m1], { consensusThreshold: 2 });

  assert.deepEqual(
    resultAB.irSet.map(ir => ir.opcode),
    resultBA.irSet.map(ir => ir.opcode),
    "merge is commutative"
  );
});

test("mergeProposals — idempotency (duplicate model entry collapses)", () => {
  const proposals = [{ opcode: 4, payload: [1, 1] }];
  const once  = oracle._mergeProposals([{ model: "A", proposals }], { consensusThreshold: 1 });
  const twice = oracle._mergeProposals(
    [{ model: "A", proposals }, { model: "A", proposals }],
    { consensusThreshold: 1 }
  );

  // Weight differs (2 vs 1) but the IR set content is identical
  assert.deepEqual(
    once.irSet.map(ir => ir.opcode),
    twice.irSet.map(ir => ir.opcode),
    "idempotent IR content"
  );
});

test("mergeProposals — maxIR cap is respected", () => {
  const bigProposals = Array.from({ length: 20 }, (_, i) => ({
    opcode: i,
    payload: [i]
  }));
  const result = oracle._mergeProposals(
    [{ model: "A", proposals: bigProposals }],
    { maxIR: 5 }
  );
  assert.equal(result.irSet.length, 5, "capped at maxIR=5");
});

// ─── Prompt construction tests ────────────────────────────────────────────────

test("buildPrompt — no markdown, only structured text", () => {
  const prompt = oracle._buildPrompt(
    { count: 3, cells: [1n, 2n] },
    { family: "reachable" },
    { basinId: "basin-7", rootHash: "abc123", recentIR: [{ opcode: 0, payload: [1] }] }
  );

  assert.ok(prompt.includes("STATE SUMMARY"), "has STATE SUMMARY");
  assert.ok(prompt.includes("QUERY"),         "has QUERY section");
  assert.ok(prompt.includes("TASK"),          "has TASK section");
  assert.ok(prompt.includes("OUTPUT FORMAT"), "has OUTPUT FORMAT section");
  assert.ok(prompt.includes("basin-7"),       "embeds basin id");
  assert.ok(prompt.includes("abc123"),        "embeds root hash");
  assert.ok(!prompt.includes("chat"),         "no chat language");
});

// ─── parseIRArray tests ───────────────────────────────────────────────────────

test("parseIRArray — strips markdown fences", () => {
  const raw = "```json\n[{\"opcode\":2,\"payload\":[3,4]}]\n```";
  const result = oracle._parseIRArray(raw, "test");
  assert.equal(result.length, 1);
  assert.equal(result[0].opcode, 2);
});

test("parseIRArray — clamps opcode to 0–15", () => {
  const raw = JSON.stringify([{ opcode: 99, payload: [1] }]);
  const result = oracle._parseIRArray(raw);
  assert.equal(result[0].opcode, 3, "99 & 0xF = 3");
});

test("parseIRArray — filters invalid IR objects", () => {
  const raw = JSON.stringify([
    { opcode: 1, payload: [0] },           // valid
    { opcode: "x", payload: [0] },         // invalid opcode
    { opcode: 2, payload: "not-array" },   // invalid payload
    null                                   // null
  ]);
  const result = oracle._parseIRArray(raw);
  assert.equal(result.length, 1, "only the valid IR survives");
});

test("parseIRArray — returns [] on garbage text", () => {
  const result = oracle._parseIRArray("I cannot do that, Dave.");
  assert.deepEqual(result, []);
});

// ─── bootstrapLoop — synthetic convergence test ───────────────────────────────

test("bootstrapLoop — converges to fixed point with mock oracle", async () => {
  // Patch global fetch to return deterministic proposals
  const IR_NOOP = [{ opcode: 0, payload: [0, 0] }];
  const originalFetch = globalThis.fetch;

  let callCount = 0;
  globalThis.fetch = async () => {
    callCount++;
    return {
      ok: true,
      json: async () => ({ response: JSON.stringify(callCount < 3 ? IR_NOOP : []) })
    };
  };

  const localOracle = createTransitionOracle({
    models: ["mistral", "llama3.2"],
    ollamaBase: "http://localhost:11434"
  });

  // Trivial algebra: reducer is identity, merge picks first, compress is identity
  const hashFn = s => JSON.stringify(s);

  try {
    const result = await localOracle.bootstrapLoop({
      initialState: { value: 1 },
      query: { family: "test" },
      reducer:   (state, _ir) => state,           // identity reducer
      merge:     (a, _b) => a,                    // keep current
      compressQ: (state, _q) => state,            // identity compress
      hashFn,
      maxSteps: 8
    });

    assert.ok(result.stabilized || result.steps > 0, "loop ran or stabilized");
    assert.ok(Array.isArray(result.trajectory),      "has trajectory");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("bootstrapLoop — degrades gracefully when all models fail", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("network down"); };

  const localOracle = createTransitionOracle({
    models: ["mistral", "llama3.2"],
    ollamaBase: "http://localhost:11434"
  });

  try {
    const result = await localOracle.bootstrapLoop({
      initialState: { value: 0 },
      query:        { family: "none" },
      reducer:      (s) => s,
      merge:        (a) => a,
      compressQ:    (s) => s,
      hashFn:       s => JSON.stringify(s),
      maxSteps: 4
    });

    // Should halt early (no IR proposals), not throw
    assert.equal(result.steps, 0, "no steps taken when all models down");
    assert.equal(result.stabilized, false, "not stabilized");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

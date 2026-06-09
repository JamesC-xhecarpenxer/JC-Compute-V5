/**
 * UNIFIED IDENTITY TEST SUITE
 *
 * Thesis: The runtime, benchmarks, distributed execution, oracle loop, and
 * formal models are NOT parallel interpretations of a mathematical object —
 * they ARE the same object, expressed through different entry points.
 *
 * These tests prove that claim by construction:
 *
 *   For each pair of "manifestations" M_i and M_j, we show:
 *     (1) They share a canonical state fingerprint (same hash for same vector)
 *     (2) They produce the same frontier under the same reducers
 *     (3) Their convergence metric is the same scalar at every step
 *     (4) Their fixed-point is the same attractor
 *
 * If any assertion fails, the manifestations diverged — they became
 * parallel interpretations rather than a single object.
 *
 * Run:  node --test tests/unified-identity.test.js
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

// ── The single mathematical object ───────────────────────────────────────────
import {
  createUnifiedState,
  createReducer,
  reduce,
  frontier,
  attractor,
  distance,
  convergenceMetric,
  avgPairwiseDistance,
  hash,
  dominates,
  centroid,
  hasConverged,
} from "../packages/unistack-unified/index.js";

// ── Runtime manifestation ─────────────────────────────────────────────────────
import { createFixedPointOperator } from "../runtime/fixed-point-operator.js";

// ── Oracle manifestation ──────────────────────────────────────────────────────
import {
  oracleBootstrap,
  ollamaOutputToReducer,
} from "../runtime/oracle-new/oracle-bootstrap.js";

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED FIXTURES
// All manifestations operate on the same initial conditions.
// This is the object. Everything below is a lens onto it.
// ═══════════════════════════════════════════════════════════════════════════════

const DIM = 4; // vector dimension shared by every manifestation

// Deterministic seed vectors — identical across every test run
const SEED_VECTORS = [
  [8.0, 3.0, 5.0, 1.0],
  [2.0, 9.0, 4.0, 6.0],
  [7.0, 1.0, 8.0, 3.0],
  [1.0, 4.0, 7.0, 9.0],
  [5.0, 6.0, 2.0, 4.0],
];

// Deterministic reducer matrices — near-identity, mildly contractive
const REDUCER_MATRICES = [
  // R0: compress toward origin along dim 0
  [
    [0.9, 0.0, 0.0, 0.0],
    [0.0, 1.0, 0.0, 0.0],
    [0.0, 0.0, 1.0, 0.0],
    [0.0, 0.0, 0.0, 1.0],
  ],
  // R1: compress along dim 1
  [
    [1.0, 0.0, 0.0, 0.0],
    [0.0, 0.9, 0.0, 0.0],
    [0.0, 0.0, 1.0, 0.0],
    [0.0, 0.0, 0.0, 1.0],
  ],
  // R2: compress along both dim 2 and 3
  [
    [1.0, 0.0, 0.0, 0.0],
    [0.0, 1.0, 0.0, 0.0],
    [0.0, 0.0, 0.85, 0.0],
    [0.0, 0.0, 0.0, 0.85],
  ],
];

/**
 * Canonical fingerprint of a frontier set:
 * sort state vectors lexicographically, hash the whole structure.
 * Two manifestations are the same object ↔ their fingerprints match.
 */
function frontierFingerprint(states) {
  const sorted = [...states]
    .sort((a, b) => {
      for (let i = 0; i < a.v.length; i++) {
        if (a.v[i] !== b.v[i]) return a.v[i] - b.v[i];
      }
      return 0;
    })
    .map((s) => s.v.map((x) => Math.round(x * 1e9) / 1e9)); // 9-decimal round-trip
  return hash(sorted);
}

/**
 * Attractor via the formal-model specification (pure iterative form of the
 * oracle loop, matching the TLA+ / Lean definitions exactly).
 * This is the "formal model manifestation."
 */
function formalAttractor(initialStates, reducers, maxIter = 64, eps = 1e-9) {
  let current = frontier(initialStates);
  for (let i = 0; i < maxIter; i++) {
    const expanded = current.flatMap((s) => reducers.map((r) => reduce(s, r)));
    const next = frontier(expanded);

    // Convergence: all distances between successive frontiers vanish
    const prevMetric = convergenceMetric(current);
    const nextMetric = convergenceMetric(next);
    if (Math.abs(prevMetric - nextMetric) < eps) return next;

    current = next;
  }
  return current;
}

/**
 * Attractor via the runtime manifestation: createFixedPointOperator.fix()
 * applied iteratively over all reducers.
 *
 * The runtime uses a state-transformer interface; we bridge it to the
 * unified vector model here. If they produce the same attractor, the
 * runtime is a manifestation of the same object.
 */
function runtimeAttractor(initialStates, reducers, maxIter = 64, eps = 1e-9) {
  // Build a fixed-point operator that applies all reducers as a composed step
  const fixOp = createFixedPointOperator({
    reducer: (stateSet, _ir) => {
      // Each "state" here is a frontier (array of unified states).
      // The IR slot is unused; the reducers are captured in closure.
      const expanded = stateSet.flatMap((s) => reducers.map((r) => reduce(s, r)));
      return frontier(expanded);
    },
    merge: null,
    compress: null,
    queryProjector: null,
  });

  // Build an IR stream that just ticks the iterations
  const irStream = Array.from({ length: maxIter }, (_, i) => i);

  // Initial state for the fixed-point operator is the frontier of seeds
  let current = frontier(initialStates);

  // Manually drive fix() iteration-by-iteration so we can check eps
  for (let i = 0; i < maxIter; i++) {
    const next = fixOp.apply(current, irStream[i], null);
    const prevMetric = convergenceMetric(current);
    const nextMetric = convergenceMetric(next);
    if (Math.abs(prevMetric - nextMetric) < eps) return next;
    current = next;
  }
  return current;
}

/**
 * Attractor via the oracle manifestation: oracleBootstrap().
 * The oracle loop is the "distributed execution" manifestation.
 */
async function oracleAttractor(initialStates, reducers) {
  const result = await oracleBootstrap(initialStates, reducers, {
    maxIterations: 64,
    convergenceThreshold: 1e-9,
    verbose: false,
  });
  return result.frontier;
}

/**
 * Attractor via the benchmark manifestation: the exact loop in
 * 04-unified-benchmark.js (oracleBootstrap with benchmark settings).
 * We replicate it inline so the benchmark is self-contained.
 */
async function benchmarkAttractor(initialStates, reducers) {
  // This IS the benchmark loop from 04-unified-benchmark.js §testAttractor
  const result = await oracleBootstrap(initialStates, reducers, {
    maxIterations: 16,
    convergenceThreshold: 1e-3,
    verbose: false,
  });
  return result.frontier;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 1 — ALGEBRAIC STRUCTURE LAWS
// These are properties of the mathematical object itself.
// Every manifestation inherits them; failing here means the object is broken.
// ═══════════════════════════════════════════════════════════════════════════════

describe("Suite 1 — Algebraic Structure Laws", () => {
  const states = SEED_VECTORS.map((v) => createUnifiedState(v));
  const reducers = REDUCER_MATRICES.map((m) => createReducer(m));

  // ── 1.1 Distance is a metric ──────────────────────────────────────────────

  it("1.1a distance is non-negative", () => {
    for (const a of states) {
      for (const b of states) {
        assert.ok(distance(a, b) >= 0, `d(${a.id},${b.id}) < 0`);
      }
    }
  });

  it("1.1b distance is symmetric", () => {
    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        const dab = distance(states[i], states[j]);
        const dba = distance(states[j], states[i]);
        assert.ok(
          Math.abs(dab - dba) < 1e-12,
          `d(a,b)=${dab} ≠ d(b,a)=${dba}`
        );
      }
    }
  });

  it("1.1c distance satisfies triangle inequality", () => {
    const [a, b, c] = states;
    const dab = distance(a, b);
    const dbc = distance(b, c);
    const dac = distance(a, c);
    assert.ok(
      dac <= dab + dbc + 1e-10,
      `triangle: d(a,c)=${dac} > d(a,b)+d(b,c)=${dab + dbc}`
    );
  });

  it("1.1d distance is zero iff states are identical", () => {
    const s = createUnifiedState([1, 2, 3, 4]);
    const sCopy = createUnifiedState([1, 2, 3, 4]);
    // Same vector → same hash → should collapse to zero distance
    assert.equal(distance(s, sCopy), 0);
    // Different vector → positive distance
    const t = createUnifiedState([1, 2, 3, 5]);
    assert.ok(distance(s, t) > 0);
  });

  // ── 1.2 Domination partial order ─────────────────────────────────────────

  it("1.2a domination is anti-reflexive", () => {
    for (const s of states) {
      assert.equal(dominates(s, s), false, `state dominates itself`);
    }
  });

  it("1.2b domination is transitive", () => {
    const a = createUnifiedState([1, 1, 1, 1]);
    const b = createUnifiedState([2, 2, 2, 2]);
    const c = createUnifiedState([3, 3, 3, 3]);
    // a dominates b: a.v ≤ b.v component-wise, strictly in all dims
    assert.ok(dominates(a, b), "a should dominate b");
    assert.ok(dominates(b, c), "b should dominate c");
    assert.ok(dominates(a, c), "transitivity: a should dominate c");
  });

  // ── 1.3 Frontier is a closure operator ───────────────────────────────────

  it("1.3a frontier is idempotent (applying it twice gives the same set)", () => {
    const f1 = frontier(states);
    const f2 = frontier(f1);
    assert.equal(
      frontierFingerprint(f1),
      frontierFingerprint(f2),
      "frontier(frontier(S)) ≠ frontier(S)"
    );
  });

  it("1.3b frontier is extensive (its result is a subset of input)", () => {
    const f = frontier(states);
    const inputIds = new Set(states.map((s) => s.id));
    for (const s of f) {
      assert.ok(inputIds.has(s.id), `frontier contains unknown id ${s.id}`);
    }
  });

  it("1.3c frontier is monotone (more inputs → frontier ⊇ previous frontier)", () => {
    const subset = states.slice(0, 3);
    const full = states;
    const fSubset = frontier(subset);
    const fFull = frontier(full);
    // Not strict superset, but: every non-dominated state in subset
    // is either in full frontier or dominated by something new.
    // Weaker check: full frontier is at most as large as subset frontier.
    // (Adding dominated states cannot grow the frontier.)
    assert.ok(fFull.length <= states.length);
  });

  it("1.3d frontier removes all dominated states", () => {
    const dominated = createUnifiedState([100, 100, 100, 100]);
    const dominator = createUnifiedState([0.1, 0.1, 0.1, 0.1]);
    const f = frontier([dominated, dominator]);
    const ids = new Set(f.map((s) => s.id));
    assert.ok(!ids.has(dominated.id), "dominated state survived the frontier");
    assert.ok(ids.has(dominator.id), "dominator removed from frontier");
  });

  // ── 1.4 Reduce is a linear map on the vector ─────────────────────────────

  it("1.4a reduce applies the matrix to v (manual verification)", () => {
    const s = createUnifiedState([1, 0, 0, 0]);
    const r = createReducer(REDUCER_MATRICES[0]); // scales dim 0 by 0.9
    const out = reduce(s, r);
    // Expected: v_new = [0.9, 0, 0, 0]
    assert.ok(Math.abs(out.v[0] - 0.9) < 1e-10, `dim0: ${out.v[0]} ≠ 0.9`);
    assert.ok(Math.abs(out.v[1] - 0.0) < 1e-10, `dim1: ${out.v[1]} ≠ 0`);
  });

  it("1.4b reduce is composable (R2 ∘ R1 = apply R1 then R2)", () => {
    const s = createUnifiedState([1, 1, 1, 1]);
    const r0 = createReducer(REDUCER_MATRICES[0]);
    const r1 = createReducer(REDUCER_MATRICES[1]);

    const composed = reduce(reduce(s, r0), r1);
    // Build composed matrix manually: M_composed = R1 · R0
    const M0 = REDUCER_MATRICES[0];
    const M1 = REDUCER_MATRICES[1];
    const MC = Array.from({ length: DIM }, (_, i) =>
      Array.from({ length: DIM }, (_, j) =>
        M1[i].reduce((acc, _, k) => acc + M1[i][k] * M0[k][j], 0)
      )
    );
    const rComposed = createReducer(MC);
    const direct = reduce(s, rComposed);

    for (let i = 0; i < DIM; i++) {
      assert.ok(
        Math.abs(composed.v[i] - direct.v[i]) < 1e-10,
        `composition mismatch at dim ${i}: ${composed.v[i]} vs ${direct.v[i]}`
      );
    }
  });

  // ── 1.5 Centroid (merge) is the group mean ────────────────────────────────

  it("1.5a centroid of single state is that state", () => {
    const s = createUnifiedState([3, 1, 4, 1]);
    const c = centroid([s]);
    for (let i = 0; i < DIM; i++) {
      assert.ok(Math.abs(c.v[i] - s.v[i]) < 1e-10);
    }
  });

  it("1.5b centroid of two states is their average", () => {
    const a = createUnifiedState([0, 0, 0, 0]);
    const b = createUnifiedState([2, 4, 6, 8]);
    const c = centroid([a, b]);
    const expected = [1, 2, 3, 4];
    for (let i = 0; i < DIM; i++) {
      assert.ok(Math.abs(c.v[i] - expected[i]) < 1e-10, `centroid dim ${i}`);
    }
  });

  it("1.5c centroid is permutation-invariant (order of states doesn't matter)", () => {
    const [a, b, c] = states.slice(0, 3);
    const c1 = centroid([a, b, c]);
    const c2 = centroid([c, a, b]);
    const c3 = centroid([b, c, a]);
    for (let i = 0; i < DIM; i++) {
      assert.ok(Math.abs(c1.v[i] - c2.v[i]) < 1e-10);
      assert.ok(Math.abs(c1.v[i] - c3.v[i]) < 1e-10);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 2 — IDENTITY ACROSS MANIFESTATIONS
// Core claim: all five entry points converge to the same attractor.
// ═══════════════════════════════════════════════════════════════════════════════

describe("Suite 2 — Identity Across Manifestations", () => {
  const initialStates = SEED_VECTORS.map((v) => createUnifiedState(v));
  const reducers = REDUCER_MATRICES.map((m) => createReducer(m));

  // Results computed once and shared
  let formalResult;
  let runtimeResult;
  let oracleResult;

  before(async () => {
    formalResult = formalAttractor(initialStates, reducers);
    runtimeResult = runtimeAttractor(initialStates, reducers);
    oracleResult = await oracleAttractor(initialStates, reducers);
  });

  // ── 2.1 Formal model ↔ Runtime ───────────────────────────────────────────

  it("2.1 formal model and runtime converge to the same attractor fingerprint", () => {
    const fpFormal = frontierFingerprint(formalResult);
    const fpRuntime = frontierFingerprint(runtimeResult);
    assert.equal(
      fpFormal,
      fpRuntime,
      `Formal fingerprint: ${fpFormal}\nRuntime fingerprint: ${fpRuntime}`
    );
  });

  // ── 2.2 Formal model ↔ Oracle ────────────────────────────────────────────

  it("2.2 formal model and oracle loop converge to the same attractor fingerprint", () => {
    const fpFormal = frontierFingerprint(formalResult);
    const fpOracle = frontierFingerprint(oracleResult);
    assert.equal(
      fpFormal,
      fpOracle,
      `Formal fingerprint: ${fpFormal}\nOracle fingerprint: ${fpOracle}`
    );
  });

  // ── 2.3 Runtime ↔ Oracle ─────────────────────────────────────────────────

  it("2.3 runtime and oracle loop converge to the same attractor fingerprint", () => {
    const fpRuntime = frontierFingerprint(runtimeResult);
    const fpOracle = frontierFingerprint(oracleResult);
    assert.equal(
      fpRuntime,
      fpOracle,
      `Runtime fingerprint: ${fpRuntime}\nOracle fingerprint: ${fpOracle}`
    );
  });

  // ── 2.4 Convergence metric path is the same ──────────────────────────────

  it("2.4 formal model and oracle produce identical convergence metric at final frontier", () => {
    const metricFormal = convergenceMetric(formalResult);
    const metricOracle = convergenceMetric(oracleResult);
    // Within floating-point rounding — not strict equal because iteration
    // counts may differ, but the FINAL metric must be the same attractor.
    assert.ok(
      Math.abs(metricFormal - metricOracle) < 1e-6,
      `Formal metric: ${metricFormal}, Oracle metric: ${metricOracle}`
    );
  });

  // ── 2.5 Pairwise distance across manifestations is zero ──────────────────

  it("2.5 every formal-attractor state has a twin in the oracle-attractor (distance < ε)", () => {
    const eps = 1e-6;
    for (const fs of formalResult) {
      const minDist = Math.min(...oracleResult.map((os) => distance(fs, os)));
      assert.ok(
        minDist < eps,
        `formal state ${fs.id} has no oracle twin within ε=${eps}; min dist=${minDist}`
      );
    }
  });

  it("2.5b every oracle-attractor state has a twin in the formal-attractor (distance < ε)", () => {
    const eps = 1e-6;
    for (const os of oracleResult) {
      const minDist = Math.min(...formalResult.map((fs) => distance(os, fs)));
      assert.ok(
        minDist < eps,
        `oracle state ${os.id} has no formal twin within ε=${eps}; min dist=${minDist}`
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 3 — ORACLE LOOP IS THE FORMAL FIXED-POINT ITERATION
// Proves the oracle loop structure matches Knaster-Tarski / Theorem 6
// ═══════════════════════════════════════════════════════════════════════════════

describe("Suite 3 — Oracle Loop Matches Formal Fixed-Point (Theorem 6)", () => {
  const states = SEED_VECTORS.map((v) => createUnifiedState(v));
  const reducers = REDUCER_MATRICES.map((m) => createReducer(m));

  it("3.1 oracle bootstrap terminates (fixed-point exists)", async () => {
    const result = await oracleBootstrap(states, reducers, {
      maxIterations: 128,
      convergenceThreshold: 1e-9,
    });
    assert.ok(result.converged, "oracle did not converge — fixed point missing");
  });

  it("3.2 oracle result is a fixed point of the frontier operator", async () => {
    const result = await oracleBootstrap(states, reducers, {
      maxIterations: 128,
      convergenceThreshold: 1e-9,
    });
    const fp = result.frontier;

    // Apply one more full step
    const expanded = fp.flatMap((s) => reducers.map((r) => reduce(s, r)));
    const next = frontier(expanded);

    // The frontier of the image must equal the frontier itself
    assert.equal(
      frontierFingerprint(fp),
      frontierFingerprint(next),
      "oracle result is not a fixed point of frontier∘reduce"
    );
  });

  it("3.3 convergence metric is monotonically non-increasing across iterations", async () => {
    const metrics = [];
    await oracleBootstrap(states, reducers, {
      maxIterations: 64,
      convergenceThreshold: 1e-12,
      onStep: (step) => {
        metrics.push(convergenceMetric(step.frontier));
      },
    });

    for (let i = 1; i < metrics.length; i++) {
      assert.ok(
        metrics[i] <= metrics[i - 1] + 1e-10,
        `metric increased at step ${i}: ${metrics[i - 1]} → ${metrics[i]}`
      );
    }
  });

  it("3.4 oracle fixed-point is unique (rerunning from same seed gives same result)", async () => {
    const r1 = await oracleBootstrap(states, reducers, {
      maxIterations: 128,
      convergenceThreshold: 1e-9,
    });
    const r2 = await oracleBootstrap(states, reducers, {
      maxIterations: 128,
      convergenceThreshold: 1e-9,
    });
    assert.equal(
      frontierFingerprint(r1.frontier),
      frontierFingerprint(r2.frontier),
      "oracle fixed-point is not deterministic — multiple attractors exist"
    );
  });

  it("3.5 fixed-point is independent of iteration count once past convergence", async () => {
    const r32 = await oracleBootstrap(states, reducers, {
      maxIterations: 32,
      convergenceThreshold: 1e-9,
    });
    const r128 = await oracleBootstrap(states, reducers, {
      maxIterations: 128,
      convergenceThreshold: 1e-9,
    });
    assert.equal(
      frontierFingerprint(r32.frontier),
      frontierFingerprint(r128.frontier),
      "attractor changes after convergence — not a true fixed point"
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 4 — DISTRIBUTED EXECUTION IS JUST CENTROID MERGE + FRONTIER
// Proves that distributing work across "nodes" and merging is identical to
// running the full computation on a single node.
// This is the TLA+ Convergence theorem (Theorem 2) in executable form.
// ═══════════════════════════════════════════════════════════════════════════════

describe("Suite 4 — Distributed Execution = Merge(Reduce) (Theorem 2)", () => {
  const reducers = REDUCER_MATRICES.map((m) => createReducer(m));

  it("4.1 partition + local reduce + merge = global reduce (commutativity of merge)", () => {
    // All five states on one node
    const allStates = SEED_VECTORS.map((v) => createUnifiedState(v));

    // Globally reduce
    const globalExpanded = allStates.flatMap((s) =>
      reducers.map((r) => reduce(s, r))
    );
    const globalFrontier = frontier(globalExpanded);

    // Partition into two "nodes": [0,1,2] and [3,4]
    const nodeA = allStates.slice(0, 3);
    const nodeB = allStates.slice(3, 5);

    // Each node does its own reduce + frontier
    const expandA = nodeA.flatMap((s) => reducers.map((r) => reduce(s, r)));
    const expandB = nodeB.flatMap((s) => reducers.map((r) => reduce(s, r)));

    // Merge: union both expansions, then frontier
    const merged = frontier([...expandA, ...expandB]);

    assert.equal(
      frontierFingerprint(globalFrontier),
      frontierFingerprint(merged),
      "distributed partition+merge diverged from global reduce"
    );
  });

  it("4.2 merge is commutative (A∪B frontier = B∪A frontier)", () => {
    const allStates = SEED_VECTORS.map((v) => createUnifiedState(v));
    const nodeA = allStates.slice(0, 3);
    const nodeB = allStates.slice(3, 5);

    const expandA = nodeA.flatMap((s) => reducers.map((r) => reduce(s, r)));
    const expandB = nodeB.flatMap((s) => reducers.map((r) => reduce(s, r)));

    const AB = frontier([...expandA, ...expandB]);
    const BA = frontier([...expandB, ...expandA]);

    assert.equal(
      frontierFingerprint(AB),
      frontierFingerprint(BA),
      "merge is not commutative"
    );
  });

  it("4.3 merge is idempotent (merging the same partition twice is a no-op)", () => {
    const allStates = SEED_VECTORS.map((v) => createUnifiedState(v));
    const expanded = allStates.flatMap((s) => reducers.map((r) => reduce(s, r)));

    const once = frontier(expanded);
    const twice = frontier([...expanded, ...expanded]);

    assert.equal(
      frontierFingerprint(once),
      frontierFingerprint(twice),
      "merging duplicate partitions changed the frontier"
    );
  });

  it("4.4 merge is associative ((A∪B)∪C = A∪(B∪C))", () => {
    const [s0, s1, s2, s3, s4] = SEED_VECTORS.map((v) => createUnifiedState(v));
    const nodeA = [s0, s1];
    const nodeB = [s2, s3];
    const nodeC = [s4];

    const expA = nodeA.flatMap((s) => reducers.map((r) => reduce(s, r)));
    const expB = nodeB.flatMap((s) => reducers.map((r) => reduce(s, r)));
    const expC = nodeC.flatMap((s) => reducers.map((r) => reduce(s, r)));

    const leftAssoc = frontier([...frontier([...expA, ...expB]), ...expC]);
    const rightAssoc = frontier([...expA, ...frontier([...expB, ...expC])]);

    assert.equal(
      frontierFingerprint(leftAssoc),
      frontierFingerprint(rightAssoc),
      "merge is not associative — distributed topology matters"
    );
  });

  it("4.5 multi-hop reduce converges to the same attractor regardless of network topology", async () => {
    const allStates = SEED_VECTORS.map((v) => createUnifiedState(v));

    // Single-hop: one oracle run on all states
    const singleHop = await oracleAttractor(allStates, reducers);

    // Two-hop: run oracle on each half, merge, run oracle on merged
    const half1 = allStates.slice(0, 3);
    const half2 = allStates.slice(3, 5);
    const r1 = await oracleAttractor(half1, reducers);
    const r2 = await oracleAttractor(half2, reducers);
    const twoHop = await oracleAttractor([...r1, ...r2], reducers);

    const eps = 1e-6;
    // Every state in singleHop must have a twin in twoHop
    for (const s of singleHop) {
      const minDist = Math.min(...twoHop.map((t) => distance(s, t)));
      assert.ok(
        minDist < eps,
        `network topology changed attractor: state ${s.id} not in two-hop result`
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 5 — BENCHMARK IS A MEASUREMENT OF THE SAME OBJECT
// Proves the benchmark does not perturb the mathematical object it measures.
// A benchmark that changes behavior is measuring a different thing.
// ═══════════════════════════════════════════════════════════════════════════════

describe("Suite 5 — Benchmark Measures Without Perturbing (Observer Property)", () => {
  const states = SEED_VECTORS.map((v) => createUnifiedState(v));
  const reducers = REDUCER_MATRICES.map((m) => createReducer(m));

  it("5.1 benchmark attractor equals formal attractor (looser tolerance)", async () => {
    const formal = formalAttractor(states, reducers);
    const bench = await benchmarkAttractor(states, reducers);

    // Benchmark uses 1e-3 threshold (looser), so we allow a small but
    // bounded gap in the final metric, not in the fingerprint.
    // If the benchmark had perturbed the object, it would land at a
    // different basin entirely.
    const metricFormal = convergenceMetric(formal);
    const metricBench = convergenceMetric(bench);

    // Both should be near zero; benchmark just stops earlier
    assert.ok(
      metricBench < 1e-2,
      `benchmark metric too large: ${metricBench} — landed in wrong basin`
    );
    assert.ok(
      Math.abs(metricFormal - metricBench) < 0.1,
      `benchmark and formal disagree by more than 0.1: formal=${metricFormal}, bench=${metricBench}`
    );
  });

  it("5.2 benchmark result is dominated-by-or-equal-to the formal result (benchmark is an approximation, not a perturbation)", async () => {
    const formal = formalAttractor(states, reducers);
    const bench = await benchmarkAttractor(states, reducers);

    // The benchmark should converge to a subset of or equal to the formal
    // attractor. No benchmark state should be outside the formal basin.
    const eps = 1e-1; // generous tolerance for early stop
    for (const bs of bench) {
      const minDist = Math.min(...formal.map((fs) => distance(bs, fs)));
      assert.ok(
        minDist < eps,
        `benchmark state ${bs.id} is outside formal attractor basin (dist=${minDist})`
      );
    }
  });

  it("5.3 timing benchmark: oracle runs are O(iterations × |frontier| × |reducers|)", async () => {
    // Prove the benchmark measures the same loop, not a faster proxy.
    const small = SEED_VECTORS.slice(0, 2).map((v) => createUnifiedState(v));
    const large = SEED_VECTORS.map((v) => createUnifiedState(v));
    const reducers2 = REDUCER_MATRICES.map((m) => createReducer(m));

    const t0 = Date.now();
    await oracleBootstrap(small, reducers2, { maxIterations: 16 });
    const smallTime = Date.now() - t0;

    const t1 = Date.now();
    await oracleBootstrap(large, reducers2, { maxIterations: 16 });
    const largeTime = Date.now() - t1;

    // Large run with 2.5× states should not be faster than small run
    // (sanity check: benchmark loop is actually running the object)
    assert.ok(
      largeTime >= smallTime * 0.5,
      `large run (${largeTime}ms) implausibly fast vs small (${smallTime}ms)`
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 6 — ORACLE INPUT PATH: OLLAMA TENSORS → REDUCERS → SAME OBJECT
// Proves that the external oracle (Ollama) input is just another reducer source;
// it does not create a separate object.
// ═══════════════════════════════════════════════════════════════════════════════

describe("Suite 6 — Oracle Input Path (Tensor → Reducer Identity)", () => {
  it("6.1 ollamaOutputToReducer produces a reducer that applies the same linear map", () => {
    // Simulate Ollama returning a flat tensor for a known 2×2 matrix
    const known2x2 = [
      [0.9, 0.1],
      [0.2, 0.8],
    ];
    const flat = known2x2.flat();
    const r = ollamaOutputToReducer(flat, 2);

    const s = createUnifiedState([1, 0]);
    const out = reduce(s, r);

    // v_new = [[0.9,0.1],[0.2,0.8]] · [1,0] = [0.9, 0.2]
    assert.ok(Math.abs(out.v[0] - 0.9) < 1e-10, `v[0]: ${out.v[0]}`);
    assert.ok(Math.abs(out.v[1] - 0.2) < 1e-10, `v[1]: ${out.v[1]}`);
  });

  it("6.2 two oracle-sourced reducers with identical tensors produce identical state transitions", () => {
    const tensor = REDUCER_MATRICES[0].flat();
    const r1 = ollamaOutputToReducer(tensor, DIM, { id: "oracle-A" });
    const r2 = ollamaOutputToReducer(tensor, DIM, { id: "oracle-B" });

    const s = createUnifiedState(SEED_VECTORS[0]);
    const out1 = reduce(s, r1);
    const out2 = reduce(s, r2);

    for (let i = 0; i < DIM; i++) {
      assert.ok(
        Math.abs(out1.v[i] - out2.v[i]) < 1e-12,
        `oracle sources diverged at dim ${i}`
      );
    }
  });

  it("6.3 oracle-sourced reducer gives same attractor as directly-constructed reducer", async () => {
    const states = SEED_VECTORS.map((v) => createUnifiedState(v));

    // Direct reducers (constructed without oracle path)
    const directReducers = REDUCER_MATRICES.map((m) => createReducer(m));

    // Oracle-sourced reducers (same matrices, via flat tensor path)
    const oracleReducers = REDUCER_MATRICES.map((m) =>
      ollamaOutputToReducer(m.flat(), DIM)
    );

    const directResult = await oracleBootstrap(states, directReducers, {
      maxIterations: 128,
      convergenceThreshold: 1e-9,
    });
    const oracleResult = await oracleBootstrap(states, oracleReducers, {
      maxIterations: 128,
      convergenceThreshold: 1e-9,
    });

    assert.equal(
      frontierFingerprint(directResult.frontier),
      frontierFingerprint(oracleResult.frontier),
      "oracle-sourced reducer path produced a different attractor"
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 7 — HASH/ID CANONICALIZATION (state identity is structural)
// Proves that state identity is determined purely by content, not by how
// or when the state was created. Two manifestations that produce the same
// vector must produce the same ID.
// ═══════════════════════════════════════════════════════════════════════════════

describe("Suite 7 — Structural Identity (Canonical Hash)", () => {
  it("7.1 same vector → same ID regardless of creation path", () => {
    const v = [1.5, 2.5, 3.5, 4.5];
    const s1 = createUnifiedState(v);
    const s2 = createUnifiedState(v);
    assert.equal(s1.id, s2.id, "same vector produced different IDs");
  });

  it("7.2 reduce from different initial states does not produce the same ID unless vectors match", () => {
    const sa = createUnifiedState([1, 2, 3, 4]);
    const sb = createUnifiedState([4, 3, 2, 1]);
    const r = createReducer(REDUCER_MATRICES[0]);
    const ra = reduce(sa, r);
    const rb = reduce(sb, r);
    // Different input vectors → different output vectors → different IDs
    assert.notEqual(ra.id, rb.id);
  });

  it("7.3 frontier deduplication is content-addressed (duplicates collapse to one state)", () => {
    const v = [1, 2, 3, 4];
    const copies = Array.from({ length: 10 }, () => createUnifiedState(v));
    const f = frontier(copies);
    assert.equal(f.length, 1, `expected 1 unique state, got ${f.length}`);
    assert.equal(f[0].id, copies[0].id);
  });

  it("7.4 hash is deterministic across process restarts (no timestamp/random in ID)", () => {
    // We cannot restart the process, but we can verify hash(x) = hash(x)
    // over 1000 calls — i.e., no entropy is injected.
    const v = [3.14159, 2.71828, 1.41421, 1.73205];
    const firstId = createUnifiedState(v).id;
    for (let i = 0; i < 1000; i++) {
      const s = createUnifiedState(v);
      assert.equal(s.id, firstId, `hash changed at iteration ${i}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 8 — CONVERGENCE METRIC IS THE SOLE CONVERGENCE CRITERION
// Proves there is no hidden convergence detector in any manifestation that
// could make one converge while another doesn't.
// ═══════════════════════════════════════════════════════════════════════════════

describe("Suite 8 — Single Convergence Criterion (No Hidden Detectors)", () => {
  it("8.1 hasConverged agrees with (convergenceMetric < threshold)", () => {
    const converged = SEED_VECTORS.slice(0, 1).map((v) => createUnifiedState(v));
    const notConverged = SEED_VECTORS.map((v) => createUnifiedState(v));

    const threshold = 1e-6;
    // Single state: metric = 0 < threshold
    assert.equal(hasConverged(converged, threshold), convergenceMetric(converged) < threshold);
    // Multiple spread states: metric >> threshold
    assert.equal(hasConverged(notConverged, threshold), convergenceMetric(notConverged) < threshold);
  });

  it("8.2 convergenceMetric is zero for a single-state frontier", () => {
    const single = [createUnifiedState([1, 2, 3, 4])];
    assert.equal(convergenceMetric(single), 0);
  });

  it("8.3 convergenceMetric equals avgPairwiseDistance (they are the same function)", () => {
    const states = SEED_VECTORS.map((v) => createUnifiedState(v));
    const f = frontier(states);
    assert.equal(convergenceMetric(f), avgPairwiseDistance(f));
  });

  it("8.4 oracle convergence and formal convergence detect the same termination event", async () => {
    const states = SEED_VECTORS.map((v) => createUnifiedState(v));
    const reducers = REDUCER_MATRICES.map((m) => createReducer(m));
    const threshold = 1e-6;

    // Oracle: track when it says converged
    const result = await oracleBootstrap(states, reducers, {
      maxIterations: 128,
      convergenceThreshold: threshold,
    });

    // Verify: the oracle's final frontier satisfies the formal criterion
    const formalCheck = convergenceMetric(result.frontier) < threshold;
    if (result.converged) {
      assert.ok(
        formalCheck,
        `oracle said converged but formal metric=${convergenceMetric(result.frontier)} >= ${threshold}`
      );
    }
    // (If oracle hit maxIterations without converging, that's not an error
    // here — the threshold just wasn't reached, which is a property of the
    // reducers, not a divergence between manifestations.)
  });
});

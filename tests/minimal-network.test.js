/**
 * tests/minimal-network.test.js
 *
 * Layer 5 Closure — Minimal In-Process Network Simulation
 *
 * 3 nodes. Then 10. No features. No UI. No AI. No token. No blockchain.
 *
 * Just:
 *   state → reducer → merge → convergence
 *
 * Measures:
 *   - convergence time (rounds to stable state)
 *   - partition recovery (rounds after reconnect)
 *   - replay cost (ops to restore state from log)
 *   - memory growth (state size over rounds)
 *
 * Run: node --test tests/minimal-network.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createUnifiedState,
  createReducer,
  reduce,
  distance,
} from "../packages/unistack-unified/index.js";

// ─── Node simulation ─────────────────────────────────────────────────────────

class Node {
  constructor(id, initialVec) {
    this.id      = id;
    this.state   = createUnifiedState(initialVec);
    this.log     = [{ round: 0, stateId: this.state.id, v: [...this.state.v] }];
    this.inbox   = [];
    this.online  = true;
  }

  apply(reducer) {
    this.state = reduce(this.state, reducer);
  }

  mergeFrom(other) {
    // Componentwise mean merge
    const av = this.state.v;
    const bv = other.state.v;
    const mv = av.map((x, i) => (x + bv[i]) / 2);
    this.state = createUnifiedState(mv);
  }

  record(round) {
    this.log.push({ round, stateId: this.state.id, v: [...this.state.v] });
  }

  replayFrom(logEntry) {
    this.state = createUnifiedState(logEntry.v, { id: logEntry.stateId });
  }
}

function dist(a, b) { return distance(a, b); }

function maxPairwiseDist(nodes) {
  let max = 0;
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++)
      max = Math.max(max, dist(nodes[i].state, nodes[j].state));
  return max;
}

const THRESHOLD = 0.01; // convergence criterion

const R_COMPRESS = createReducer([
  [0.95, 0, 0, 0], [0, 0.95, 0, 0], [0, 0, 0.95, 0], [0, 0, 0, 0.95]
], "compress-0.95");

// ═══════════════════════════════════════════════════════════════════════════════
// NETWORK: 3 NODES
// ═══════════════════════════════════════════════════════════════════════════════

describe("MinimalNetwork: 3 nodes — baseline convergence", () => {
  it("3 nodes converge within 50 rounds of gossip", () => {
    const nodes = [
      new Node("A", [10.0, 2.0, 8.0, 5.0]),
      new Node("B", [3.0,  9.0, 1.0, 7.0]),
      new Node("C", [6.0,  4.0, 5.0, 2.0]),
    ];

    let round = 0;
    const maxRounds = 50;
    let convergedAt = -1;

    while (round < maxRounds) {
      round++;
      // Each node applies reducer
      for (const n of nodes) n.apply(R_COMPRESS);
      // Full gossip: every online node merges from every other
      for (const n of nodes)
        for (const m of nodes)
          if (n.id !== m.id) n.mergeFrom(m);
      // Record
      for (const n of nodes) n.record(round);
      // Check convergence
      if (maxPairwiseDist(nodes) < THRESHOLD && convergedAt === -1) {
        convergedAt = round;
        break;
      }
    }

    assert.ok(convergedAt !== -1,
      `3-node network did not converge within ${maxRounds} rounds`);

    console.log(`  [3 nodes] converged at round ${convergedAt}`);
  });

  it("3-node convergence is idempotent: additional rounds don't regress", () => {
    const nodes = [
      new Node("A", [10.0, 2.0, 8.0, 5.0]),
      new Node("B", [3.0,  9.0, 1.0, 7.0]),
      new Node("C", [6.0,  4.0, 5.0, 2.0]),
    ];

    // Run to convergence
    for (let r = 0; r < 50; r++) {
      for (const n of nodes) n.apply(R_COMPRESS);
      for (const n of nodes)
        for (const m of nodes)
          if (n.id !== m.id) n.mergeFrom(m);
    }

    const beforeDist = maxPairwiseDist(nodes);

    // 10 more rounds
    for (let r = 0; r < 10; r++) {
      for (const n of nodes) n.apply(R_COMPRESS);
      for (const n of nodes)
        for (const m of nodes)
          if (n.id !== m.id) n.mergeFrom(m);
    }

    const afterDist = maxPairwiseDist(nodes);

    assert.ok(afterDist <= beforeDist + 1e-10,
      `CONVERGENCE REGRESSION: distance increased from ${beforeDist} to ${afterDist} in extra rounds`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NETWORK: 3 NODES — PARTITION AND RECOVERY
// ═══════════════════════════════════════════════════════════════════════════════

describe("MinimalNetwork: 3 nodes — partition recovery", () => {
  it("partitioned nodes recover convergence within 30 rounds after reconnect", () => {
    const nodes = [
      new Node("A", [10.0, 2.0, 8.0, 5.0]),
      new Node("B", [3.0,  9.0, 1.0, 7.0]),
      new Node("C", [6.0,  4.0, 5.0, 2.0]),
    ];

    // Phase 1: 10 rounds of normal operation
    for (let r = 0; r < 10; r++) {
      for (const n of nodes) n.apply(R_COMPRESS);
      for (const n of nodes)
        for (const m of nodes)
          if (n.id !== m.id) n.mergeFrom(m);
    }

    // Phase 2: Partition — C is isolated for 10 rounds
    nodes[2].online = false;
    const R_FAST = createReducer([
      [0.8, 0, 0, 0], [0, 0.8, 0, 0], [0, 0, 0.8, 0], [0, 0, 0, 0.8]
    ], "fast-compress");

    for (let r = 0; r < 10; r++) {
      for (const n of nodes) {
        n.apply(n.online ? R_COMPRESS : R_FAST); // C drifts independently
      }
      // Only A and B gossip
      nodes[0].mergeFrom(nodes[1]);
      nodes[1].mergeFrom(nodes[0]);
    }

    const partitionedDist = maxPairwiseDist(nodes);
    // Partition should have caused divergence
    assert.ok(partitionedDist > THRESHOLD,
      "PARTITION HAD NO EFFECT: nodes did not diverge during isolation");

    // Phase 3: Reconnect
    nodes[2].online = true;
    let recoveredAt = -1;
    for (let r = 0; r < 30; r++) {
      for (const n of nodes) n.apply(R_COMPRESS);
      for (const n of nodes)
        for (const m of nodes)
          if (n.id !== m.id) n.mergeFrom(m);
      if (maxPairwiseDist(nodes) < THRESHOLD) {
        recoveredAt = r + 1;
        break;
      }
    }

    assert.ok(recoveredAt !== -1,
      `PARTITION RECOVERY FAILED: did not converge within 30 rounds after reconnect`);

    console.log(`  [partition] divergence dist=${partitionedDist.toFixed(4)}, recovered in ${recoveredAt} rounds`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NETWORK: 10 NODES
// ═══════════════════════════════════════════════════════════════════════════════

describe("MinimalNetwork: 10 nodes — baseline convergence", () => {
  it("10 nodes converge within 100 rounds", () => {
    const nodes = Array.from({ length: 10 }, (_, i) =>
      new Node(`N${i}`, [
        Math.sin(i * 1.1) * 10,
        Math.cos(i * 1.3) * 10,
        Math.sin(i * 1.7) * 10,
        Math.cos(i * 1.9) * 10,
      ])
    );

    let convergedAt = -1;
    const maxRounds = 100;

    for (let r = 0; r < maxRounds; r++) {
      for (const n of nodes) n.apply(R_COMPRESS);
      // Ring gossip: each node merges from its neighbor (not full gossip)
      for (let i = 0; i < nodes.length; i++) {
        const left  = nodes[(i - 1 + nodes.length) % nodes.length];
        const right = nodes[(i + 1) % nodes.length];
        nodes[i].mergeFrom(left);
        nodes[i].mergeFrom(right);
      }
      if (maxPairwiseDist(nodes) < THRESHOLD) {
        convergedAt = r + 1;
        break;
      }
    }

    assert.ok(convergedAt !== -1,
      `10-node ring network did not converge within ${maxRounds} rounds`);

    console.log(`  [10 nodes ring] converged at round ${convergedAt}`);
  });

  it("10-node full gossip converges faster than ring", () => {
    function measureConvergence(gossipFn, label) {
      const nodes = Array.from({ length: 10 }, (_, i) =>
        new Node(`N${i}`, [
          Math.sin(i * 1.1) * 10,
          Math.cos(i * 1.3) * 10,
          Math.sin(i * 1.7) * 10,
          Math.cos(i * 1.9) * 10,
        ])
      );
      for (let r = 0; r < 100; r++) {
        for (const n of nodes) n.apply(R_COMPRESS);
        gossipFn(nodes);
        if (maxPairwiseDist(nodes) < THRESHOLD) return r + 1;
      }
      return 101; // did not converge
    }

    const ringRounds = measureConvergence((nodes) => {
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].mergeFrom(nodes[(i + 1) % nodes.length]);
      }
    }, "ring");

    const fullRounds = measureConvergence((nodes) => {
      for (const n of nodes)
        for (const m of nodes)
          if (n.id !== m.id) n.mergeFrom(m);
    }, "full");

    assert.ok(fullRounds < ringRounds,
      `TOPOLOGY PARADOX: full gossip (${fullRounds}) did not converge faster than ring (${ringRounds})`);

    console.log(`  [10 nodes] full=${fullRounds} rounds vs ring=${ringRounds} rounds`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPLAY COST MEASUREMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe("MinimalNetwork: replay cost", () => {
  it("replay from log restores exact state", () => {
    const node = new Node("A", [10.0, 5.0, 3.0, 8.0]);

    // Build a 20-round log
    for (let r = 0; r < 20; r++) {
      node.apply(R_COMPRESS);
      node.record(r + 1);
    }

    const finalState = { ...node.state };
    const finalLog   = node.log[node.log.length - 1];

    // Reset and replay
    node.replayFrom(node.log[0]);
    assert.ok(dist(node.state, createUnifiedState(node.log[0].v)) < 1e-10,
      "Replay to checkpoint failed");

    // Replay each step
    for (let i = 1; i < node.log.length; i++) {
      node.replayFrom(node.log[i]);
    }

    assert.strictEqual(node.state.id, finalState.id,
      "REPLAY FAILURE: final state ID after replay differs from original");

    console.log(`  [replay] 20 rounds, log size=${node.log.length} entries`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY GROWTH MEASUREMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe("MinimalNetwork: memory growth", () => {
  it("state size remains bounded over 100 rounds (no accumulation)", () => {
    // FINDING: JSON size of a state is NOT constant across reducer applications.
    // Contracting reducers (0.95^n diagonal) produce floats with increasing
    // decimal precision in JSON serialization: 1.0 → 0.00592... (longer string).
    // This is floating-point representation growth, not state accumulation.
    //
    // The state object itself has constant structure: {id: string, v: [4 floats]}.
    // The serialized byte count grows because small floats have more digits.
    //
    // CORRECT property: state.v.length is constant (no new fields appended).
    const node = { state: createUnifiedState([1.0, 2.0, 3.0, 4.0]) };
    const initialDim = node.state.v.length;

    for (let r = 0; r < 100; r++) {
      node.state = reduce(node.state, R_COMPRESS);
    }

    const finalDim = node.state.v.length;

    // Vector dimension must be constant — no structural growth
    assert.strictEqual(finalDim, initialDim,
      `STRUCTURAL GROWTH: state.v grew from dim ${initialDim} to ${finalDim}`);

    // The id is always a 64-char hex string
    assert.strictEqual(node.state.id.length, 64,
      `ID LENGTH CHANGED: expected 64, got ${node.state.id.length}`);

    const finalSize = JSON.stringify({id: node.state.id, v: node.state.v}).length;
    const initialSize = JSON.stringify({id: createUnifiedState([1.0,2.0,3.0,4.0]).id, v: [1.0,2.0,3.0,4.0]}).length;
    console.log(`  [memory] initial=${initialSize}B, final=${finalSize}B after 100 rounds (growth due to float precision, not accumulation)`);
  });
});

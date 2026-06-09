import test from "node:test";
import assert from "node:assert/strict";
import { createField } from "../packages/unistack-core/index.js";
import { createStore } from "../packages/unistack-store/index.js";
import { paretoFrontier } from "../packages/unistack-sync/index.js";
import { createOllamaBridge } from "../runtime/ollama-bridge.js";
import {
  quotientMetrics,
  rootDivergenceDistance,
  representativeEntropy,
  withinClassGeometry
} from "../runtime/quotient-space.js";
import { compressionPhaseVector, clusterCpsVectors, basinConsistencyMap, trajectoryCoupling, perturbationResponse, perturbationMatrix, basinTransitionStatistics } from "../runtime/compression-phase-space.js";

function baseState() {
  return {
    layerType: "core",
    state: [
      createField(2, 2, [1n, 2n, 3n, 4n]),
      createField(2, 2, [1n, 2n, 3n, 4n]),
      createField(2, 2, [9n, 9n, 9n, 9n])
    ],
    reducer: { name: "r" },
    merge: { name: "m" },
    ir: { name: "i" },
    topology: { name: "t" },
    specVersion: "v3"
  };
}

function buildBridge(store) {
  return createOllamaBridge({
    ollama: {
      async generate() {
        return { response: "ok" };
      }
    },
    store,
    queryEngine: {
      project(state, query) {
        return { query, stateSize: state.state.length, family: query.family };
      }
    },
    meta: {
      kcr(before, after) {
        return before.state.length / (after.state.length || 1);
      }
    },
    sync: {
      applyDelta(state, delta) {
        const payload =
          delta.projection.query.family === "mustReach"
            ? createField(2, 2, [8n, 8n, 8n, 8n])
            : createField(2, 2, [1n, 2n, 3n, 4n]);
        return { ...state, state: [...state.state, payload] };
      },
      compressQ(candidateState) {
        return { ...candidateState, state: paretoFrontier(candidateState.state) };
      },
      merge(left, right) {
        return {
          ...left,
          ...right,
          state: paretoFrontier([...(left.state ?? []), ...(right.state ?? [])])
        };
      },
      compressionRatio(before, after) {
        return before.state.length / (after.state.length || 1);
      },
      isFixedPoint() {
        return true;
      }
    }
  });
}

async function runQueries(queries) {
  const store = createStore();
  const bridge = buildBridge(store);
  const root = store.put(baseState());
  const stream = (async function* () {
    for (const query of queries) yield query;
  })();
  let last = null;
  const trajectory = [];
  let previousRoot = root;
  for await (const result of bridge.run(root, stream)) last = result;
  if (last) {
    trajectory.push({
      rootDistance: rootDivergenceDistance(previousRoot, last.root),
      kcr: last.kcr,
      settleSteps: last.settleSteps,
      stabilized: last.stabilized
    });
  }
  const state = store.load(last.root);
  return { root, result: last, state, rootDistance: rootDivergenceDistance(root, last.root), trajectory };
}

function composeEnvelope(left, right) {
  return {
    min: Math.min(left, right),
    max: Math.max(left, right)
  };
}

test("non-commutative query streams can diverge at the fixed point boundary", async () => {
  const forward = await runQueries([
    { family: "reachable", target: "C" },
    { family: "contains", target: "D" },
    { family: "mustReach", target: "E" }
  ]);
  const reverse = await runQueries([
    { family: "mustReach", target: "E" },
    { family: "contains", target: "D" },
    { family: "reachable", target: "C" }
  ]);

  assert.ok(forward.result.kcr > 0);
  assert.ok(reverse.result.kcr > 0 || reverse.result.kcr === 0);
  assert.notStrictEqual(forward.result.root, reverse.result.root);
  assert.ok(Array.isArray(forward.state.state));
  assert.ok(Array.isArray(reverse.state.state));
  assert.ok(forward.rootDistance >= 0);
  assert.ok(reverse.rootDistance >= 0);
  assert.ok(Array.isArray(forward.trajectory));
  const metrics = quotientMetrics({
    kcr: forward.result.kcr,
    representatives: [forward.state, reverse.state],
    geometry: withinClassGeometry([forward.state, reverse.state])
  });
  assert.ok(metrics.U_Q >= 0);
  assert.ok(forward.result.settleSteps >= 1);
  assert.equal(typeof forward.result.stabilized, "boolean");
});

test("trajectory emits stepwise quotient metrics", async () => {
  const forward = await runQueries([
    { family: "reachable", target: "C" },
    { family: "contains", target: "D" }
  ]);

  assert.ok(forward.result);
  assert.ok(forward.result.kcr >= 0);
  assert.ok(forward.rootDistance >= 0);
  assert.ok(Array.isArray(forward.trajectory));
  assert.ok(forward.trajectory.length >= 1);
  assert.ok(forward.result.settleSteps >= 1);
  assert.equal(typeof forward.result.stabilized, "boolean");
});

test("query composition stays within the envelope of individual U_Q values", async () => {
  const q1 = { family: "reachable", target: "C" };
  const q2 = { family: "contains", target: "D" };
  const composed = [q1, q2];

  const one = await runQueries([q1]);
  const two = await runQueries([q2]);
  const both = await runQueries(composed);

  const m1 = quotientMetrics({
    kcr: one.result.kcr,
    representatives: [one.state],
    geometry: 0
  });
  const m2 = quotientMetrics({
    kcr: two.result.kcr,
    representatives: [two.state],
    geometry: 0
  });
  const mboth = quotientMetrics({
    kcr: both.result.kcr,
    representatives: [both.state],
    geometry: 0
  });

  const envelope = composeEnvelope(m1.U_Q, m2.U_Q);
  assert.ok(mboth.U_Q >= envelope.min - 1e-9);
  assert.ok(mboth.U_Q <= envelope.max + 1e-9);
});

test("stress runs can be embedded into CPS basins", async () => {
  const forward = await runQueries([
    { family: "reachable", target: "C" },
    { family: "contains", target: "D" }
  ]);
  const reverse = await runQueries([
    { family: "contains", target: "D" },
    { family: "reachable", target: "C" }
  ]);

  const vectors = [compressionPhaseVector(forward), compressionPhaseVector(reverse)];
  const basins = clusterCpsVectors(vectors, 50);

  assert.ok(Array.isArray(vectors));
  assert.ok(Array.isArray(basins));
  assert.ok(basins.length >= 1);
  assert.ok(basins[0].stabilityScore >= 0);
  assert.ok(basins[0].intraBasinVariance >= 0);
});

test("basin consistency map tracks semantic and geometric variance", async () => {
  const forward = await runQueries([
    { family: "reachable", target: "C" },
    { family: "contains", target: "D" }
  ]);
  const reverse = await runQueries([
    { family: "contains", target: "D" },
    { family: "reachable", target: "C" }
  ]);

  const basins = clusterCpsVectors([compressionPhaseVector(forward), compressionPhaseVector(reverse)], 50);
  const consistency = basinConsistencyMap(basins);

  assert.ok(Array.isArray(consistency.rows));
  assert.ok(consistency.rows.length >= 1);
  assert.equal(typeof consistency.alignmentCoefficient, "number");
});

test("trajectory coupling compares semantic and geometric deltas stepwise", async () => {
  const forward = await runQueries([
    { family: "reachable", target: "C" },
    { family: "contains", target: "D" },
    { family: "mustReach", target: "E" }
  ]);
  const coupling = trajectoryCoupling(forward.trajectory);

  assert.ok(Array.isArray(coupling.rows));
  assert.equal(typeof coupling.couplingCoefficient, "number");
  assert.ok(coupling.rows.length >= 0);
});

test("perturbation response measures CPS displacement", async () => {
  const baseline = await runQueries([
    { family: "reachable", target: "C" },
    { family: "contains", target: "D" }
  ]);
  const perturbed = {
    ...baseline,
    rootDistance: baseline.rootDistance + 1,
    settleSteps: baseline.result.settleSteps + 1,
    finalState: {
      ...baseline.state,
      state: baseline.state.state.slice(0, 1)
    }
  };
  const response = perturbationResponse(baseline, perturbed);

  assert.ok(response.displacement >= 0);
  assert.ok(response.semanticShift >= 0);
  assert.ok(response.geometricShift >= 0);
});

test("perturbation matrix classifies response types", async () => {
  const baseline = await runQueries([
    { family: "reachable", target: "C" },
    { family: "contains", target: "D" }
  ]);
  const matrix = perturbationMatrix(baseline, [
    {
      type: "semantic-preserving",
      run: { ...baseline, rootDistance: baseline.rootDistance + 1, settleSteps: baseline.result.settleSteps + 1, fixedPointDrift: baseline.rootDistance + 1 }
    },
    {
      type: "semantic-breaking",
      run: { ...baseline, kcr: 0, rootDistance: baseline.rootDistance + 4, settleSteps: baseline.result.settleSteps + 2, fixedPointDrift: baseline.rootDistance + 4 }
    },
    {
      type: "merge-discontinuity",
      run: { ...baseline, rootDistance: baseline.rootDistance + 7, settleSteps: baseline.result.settleSteps + 3, fixedPointDrift: baseline.rootDistance + 7 }
    }
  ]);

  assert.ok(Array.isArray(matrix));
  assert.equal(matrix.length, 3);
  assert.equal(matrix[0].type, "semantic-preserving");
  assert.equal(matrix[1].type, "semantic-breaking");
  assert.equal(matrix[2].type, "merge-discontinuity");
});

test("basin transition statistics estimate class-conditioned switching", async () => {
  const baseline = await runQueries([
    { family: "reachable", target: "C" },
    { family: "contains", target: "D" }
  ]);
  const records = perturbationMatrix(baseline, [
    {
      type: "semantic-preserving",
      run: { ...baseline, rootDistance: baseline.rootDistance + 1, settleSteps: baseline.result.settleSteps + 1, fixedPointDrift: baseline.rootDistance + 1 }
    },
    {
      type: "semantic-breaking",
      run: { ...baseline, kcr: 0, rootDistance: baseline.rootDistance + 4, settleSteps: baseline.result.settleSteps + 2, fixedPointDrift: baseline.rootDistance + 4 }
    },
    {
      type: "merge-discontinuity",
      run: { ...baseline, rootDistance: baseline.rootDistance + 7, settleSteps: baseline.result.settleSteps + 3, fixedPointDrift: baseline.rootDistance + 7 }
    }
  ]);
  const stats = basinTransitionStatistics(records, 50);

  assert.ok(Array.isArray(stats.rows));
  assert.ok(Array.isArray(stats.probabilities));
  assert.equal(typeof stats.responseEntropy, "number");
});

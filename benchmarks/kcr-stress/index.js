import { createField } from "../../packages/unistack-core/index.js";
import { normalize } from "../../packages/unistack-core/index.js";
import { createStore } from "../../packages/unistack-store/index.js";
import { paretoFrontier } from "../../packages/unistack-sync/index.js";
import { reachable, contains, mustReach } from "../../packages/unistack-query/index.js";
import { createOllamaBridge } from "../../runtime/ollama-bridge.js";
import {
  quotientMetrics,
  representativeEntropy,
  withinClassGeometry,
  rootDivergenceDistance
} from "../../runtime/quotient-space.js";
import { compressionPhaseVector, clusterCpsVectors, basinConsistencyMap, trajectoryCoupling, perturbationResponse, perturbationMatrix } from "../../runtime/compression-phase-space.js";
import { basinTransitionStatistics } from "../../runtime/compression-phase-space.js";

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
        return {
          query,
          target: query.target,
          family: query.family,
          observed: state.state.length
        };
      }
    },
    meta: {
      kcr(before, after) {
        const raw = before.state.length;
        const compressed = after.state.length || 1;
        const preservation = Number(contains(before.state[0], before.state) === contains(before.state[0], after.state));
        return preservation === 1 && compressed < raw ? raw / compressed : 0;
      }
    },
    sync: {
      applyDelta(state, delta) {
        const payloadField =
          delta?.projection?.query?.family === "contains"
            ? createField(2, 2, [1n, 2n, 3n, 4n])
            : delta?.projection?.query?.family === "reachable"
              ? createField(2, 2, [1n, 2n, 3n, 4n])
              : createField(2, 2, [8n, 8n, 8n, 8n]);

        return {
          ...state,
          state: [...state.state, payloadField],
          lastQuery: delta?.projection?.query?.family,
          lastResult: delta?.result
        };
      },
      compressQ(candidateState) {
        return {
          ...candidateState,
          state: paretoFrontier(candidateState.state)
        };
      },
      merge(left, right) {
        return {
          ...left,
          ...right,
          state: paretoFrontier([...(left.state ?? []), ...(right.state ?? [])])
        };
      },
      compressionRatio(before, after) {
        return (before.state.length || 1) / (after.state.length || 1);
      },
      isFixedPoint(root) {
        return Boolean(root);
      }
    }
  });
}

async function runStream(queries) {
  const store = createStore();
  const bridge = buildBridge(store);
  const root = store.put(baseState());
  const stream = (async function* () {
    for (const query of queries) yield query;
  })();

  let last = null;
  let previousRoot = root;
  let previousState = store.load(root);
  const trajectory = [];
  let step = 0;
  for await (const result of bridge.run(root, stream)) {
    last = result;
    const currentState = store.load(result.root);
    const geometry = withinClassGeometry([previousState, currentState]);
    const metrics = quotientMetrics({
      kcr: result.kcr,
      representatives: [previousState, currentState],
      geometry
    });
    trajectory.push({
      t: step,
      query: result.projection.query,
      root: result.root,
      previousRoot,
      rootDistance: rootDivergenceDistance(previousRoot, result.root),
      fixedPointDrift: rootDivergenceDistance(previousRoot, result.root),
      settleSteps: result.settleSteps,
      stabilized: result.stabilized,
      KCR_Q: metrics.KCR_Q,
      H_rep: metrics.H_rep,
      G_Q: metrics.G_Q,
      U_Q: metrics.U_Q
    });
    previousRoot = result.root;
    previousState = currentState;
    step += 1;
  }

  const finalState = store.load(last.root);
  const initialState = store.load(root);
  const preservation =
    Number(
      reachable(initialState.state[0], finalState.state) &&
      contains(initialState.state[0], initialState.state) &&
      contains(initialState.state[0], finalState.state) &&
      mustReach(initialState.state[0], [initialState.state[0]])
    );
  const compressionRatio = initialState.state.length / (finalState.state.length || 1);
  const rootDistance = rootDivergenceDistance(root, last.root);

  return {
    root,
    finalRoot: last.root,
    preservation,
    compressionRatio,
    kcr: last.kcr,
    finalState,
    rootDistance,
    trajectory,
    settleSteps: last.settleSteps,
    stabilized: last.stabilized
  };
}

const forward = await runStream([
  { family: "reachable", target: "C" },
  { family: "contains", target: "D" },
  { family: "mustReach", target: "E" }
]);

const reverse = await runStream([
  { family: "mustReach", target: "E" },
  { family: "contains", target: "D" },
  { family: "reachable", target: "C" }
]);

const forwardMetrics = quotientMetrics({
  kcr: forward.kcr,
  representatives: [forward.finalState, reverse.finalState],
  geometry: withinClassGeometry([forward.finalState, reverse.finalState])
});

const reverseMetrics = quotientMetrics({
  kcr: reverse.kcr,
  representatives: [reverse.finalState, forward.finalState],
  geometry: withinClassGeometry([reverse.finalState, forward.finalState])
});

const cpsVectors = [compressionPhaseVector(forward), compressionPhaseVector(reverse)];
const basinThreshold = 50;
const basins = clusterCpsVectors(cpsVectors, basinThreshold);
const basinConsistency = basinConsistencyMap(basins);
const trajectoryCouplingForward = trajectoryCoupling(forward.trajectory);
const trajectoryCouplingReverse = trajectoryCoupling(reverse.trajectory);
const perturbation = perturbationResponse(forward, {
  ...forward,
  finalState: {
    ...forward.finalState,
    state: forward.finalState.state.slice(0, 1)
  },
  rootDistance: forward.rootDistance + 1,
  settleSteps: forward.settleSteps + 1,
  fixedPointDrift: forward.rootDistance + 1
});
const perturbations = perturbationMatrix(forward, [
  {
    type: "semantic-preserving",
    run: {
      ...forward,
      rootDistance: forward.rootDistance + 1,
      settleSteps: forward.settleSteps + 1,
      fixedPointDrift: forward.rootDistance + 1
    }
  },
  {
    type: "semantic-breaking",
    run: {
      ...forward,
      kcr: 0,
      rootDistance: forward.rootDistance + 4,
      settleSteps: forward.settleSteps + 2,
      fixedPointDrift: forward.rootDistance + 4
    }
  },
  {
    type: "merge-discontinuity",
    run: {
      ...forward,
      finalState: {
        ...forward.finalState,
        state: forward.finalState.state.slice().reverse()
      },
      rootDistance: forward.rootDistance + 7,
      settleSteps: forward.settleSteps + 3,
      fixedPointDrift: forward.rootDistance + 7
    }
  }
]);
const basinTransition = basinTransitionStatistics(perturbations, basinThreshold);

console.log(JSON.stringify(normalize({
  suite: "kcr-stress",
  experiment: "non-commutative-query-streams",
  basinThreshold,
  basins,
  basinConsistency,
  trajectoryCouplingForward,
  trajectoryCouplingReverse,
  perturbation,
  perturbations,
  basinTransition,
  cpsVectors,
  forward,
  reverse,
  forwardMetrics,
  reverseMetrics,
  representativeEntropy: representativeEntropy([forward.finalState, reverse.finalState]),
  geometry: withinClassGeometry([forward.finalState, reverse.finalState]),
  sameFixedPoint: forward.finalRoot === reverse.finalRoot
}), null, 2));

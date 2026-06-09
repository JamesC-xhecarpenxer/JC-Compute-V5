import { applyReducer, createField } from "../unistack-core/index.js";
import { syncStep } from "../unistack-sync/index.js";
import { createFixedPointOperator } from "../../runtime/fixed-point-operator.js";

export function createNode({ width, height, initialCells, reducerSpec, irSpec, topology }) {
  return {
    state: [createField(width, height, initialCells)],
    reducer: applyReducer,
    reducerSpec,
    irSpec,
    topology
  };
}

export function execute(node, irs) {
  return syncStep(node, irs);
}

export function scheduler(nodes, inboxes) {
  return nodes.map((node, i) => execute(node, inboxes[i] ?? []));
}

export function layerRegistry() {
  return {
    core: "unistack-core",
    sync: "unistack-sync",
    query: "unistack-query",
    meta: "unistack-meta",
    runtime: "unistack-runtime",
    fixedPoint: "runtime/fixed-point-operator"
  };
}

export function createRuntimeFixedPointOperator({ queryProjector } = {}) {
  return createFixedPointOperator({
    reducer: (state, ir) => state.map((field) => applyReducer(field, ir)),
    merge: (state, reduced) => syncStep({ state, reducer: applyReducer }, []).state.concat(reduced),
    compress: (state) => state,
    queryProjector
  });
}

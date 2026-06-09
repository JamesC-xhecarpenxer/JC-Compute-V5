import { applyReducer, createField } from "./core.js";
import { syncStep } from "./sync.js";

export function createNode({ width, height, initialCells, reducerSpec, irSpec, topology }) {
  const field = createField(width, height, initialCells);
  return {
    state: [field],
    reducer: applyReducer,
    reducerSpec,
    irSpec,
    topology
  };
}

export function run(node, irs) {
  const synced = syncStep(node, irs);
  return synced;
}

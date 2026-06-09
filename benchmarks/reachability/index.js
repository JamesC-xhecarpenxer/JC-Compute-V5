import { createField } from "../../packages/unistack-core/index.js";
import { createStore } from "../../packages/unistack-store/index.js";
import { reachable, mustReach } from "../../packages/unistack-query/index.js";

const state = Array.from({ length: 1000 }, (_, i) => createField(2, 2, [BigInt(i), BigInt(i + 1), BigInt(i + 2), BigInt(i + 3)]));
const target = state[500];
const start = performance.now();
const can = reachable(target, state);
const must = mustReach(target, state);
const store = createStore();
const root = store.put({
  layerType: "reachability",
  state,
  reducer: { name: "reachability-reducer" },
  merge: { name: "reachability-merge" },
  ir: { name: "reachability-ir" },
  topology: { name: "reachability-topology" },
  specVersion: "v3"
});
const elapsed = performance.now() - start;

console.log(JSON.stringify({
  suite: "reachability",
  reachable: can,
  mustReach: must,
  root,
  states: state.length,
  ms: elapsed
}, null, 2));

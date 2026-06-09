import { createField } from "../../packages/unistack-core/index.js";
import { createStore } from "../../packages/unistack-store/index.js";

const store = createStore();
const child = {
  layerType: "field",
  state: [createField(2, 2, [1n, 2n, 3n, 4n])],
  reducer: { name: "lookup-child-reducer" },
  merge: { name: "lookup-child-merge" },
  ir: { name: "lookup-child-ir" },
  topology: { name: "lookup-child-topology" },
  specVersion: "v3"
};
const childRoot = store.put(child);
const object = {
  layerType: "system",
  state: [createField(4, 4, Array.from({ length: 16 }, (_, i) => BigInt(i)))],
  reducer: { name: "lookup-reducer" },
  merge: { name: "lookup-merge" },
  ir: { name: "lookup-ir", childRoot },
  topology: { name: "lookup-topology" },
  specVersion: "v3"
};
const root = store.put(object);

const iterations = 20000;
const start = performance.now();
let loaded = null;
for (let i = 0; i < iterations; i += 1) loaded = store.load(root);
const elapsed = performance.now() - start;

console.log(JSON.stringify({
  suite: "lookup",
  lookupLatencyMs: elapsed / iterations,
  walkDepth: store.walk(root).length,
  rootResolutionCost: Math.round((iterations / elapsed) * 1000),
  loaded: Boolean(loaded)
}, null, 2));

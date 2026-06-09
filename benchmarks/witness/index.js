import { createField } from "../../packages/unistack-core/index.js";
import { createStore } from "../../packages/unistack-store/index.js";
import { normalize } from "../../packages/unistack-core/index.js";

const store = createStore();
const child = {
  layerType: "field",
  state: [createField(2, 2, [1n, 2n, 3n, 4n])],
  reducer: { name: "child-reducer" },
  merge: { name: "child-merge" },
  ir: { name: "child-ir" },
  topology: { name: "child-topology" },
  specVersion: "v3"
};
const childRoot = store.put(child);
const parent = {
  layerType: "architecture",
  state: [createField(2, 2, [5n, 6n, 7n, 8n])],
  reducer: { name: "parent-reducer" },
  merge: { name: "parent-merge" },
  ir: { childRoot },
  topology: { name: "parent-topology" },
  specVersion: "v3"
};
const parentRoot = store.put(parent);

const start = performance.now();
const witnessObject = store.witness(parentRoot, child);
const elapsed = performance.now() - start;

console.log(JSON.stringify({
  suite: "witness",
  proofSize: witnessObject ? JSON.stringify(normalize(witnessObject)).length : 0,
  proofDepth: witnessObject?.depth ?? 0,
  verificationTimeMs: elapsed,
  verified: store.verify(witnessObject)
}, null, 2));

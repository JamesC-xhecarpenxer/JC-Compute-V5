import { createField } from "../../packages/unistack-core/index.js";
import { createStore } from "../../packages/unistack-store/index.js";

const store = createStore();
const objects = Array.from({ length: 2000 }, (_, i) => ({
  layerType: "field",
  state: [createField(2, 2, [BigInt(i), BigInt(i + 1), BigInt(i + 2), BigInt(i + 3)])],
  reducer: { name: "storage-reducer" },
  merge: { name: "storage-merge" },
  ir: { name: "storage-ir" },
  topology: { name: "storage-topology" },
  specVersion: "v3"
}));

const start = performance.now();
const roots = objects.map((object) => store.put(object));
const elapsed = performance.now() - start;

console.log(JSON.stringify({
  suite: "storage",
  putPerSec: Math.round((objects.length / elapsed) * 1000),
  objectsStored: objects.length,
  dedupRatio: new Set(roots).size / roots.length
}, null, 2));

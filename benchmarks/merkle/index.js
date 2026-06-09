import { createField, fieldRoot, rootOf } from "../../packages/unistack-core/index.js";

const field = createField(4, 4, Array.from({ length: 16 }, (_, i) => BigInt(i)));
const sample = {
  layerType: "core",
  state: [field],
  reducer: { name: "canonical-reducer" },
  merge: { name: "pareto-merge" },
  ir: { name: "vm-ir" },
  topology: { name: "single-node" },
  specVersion: "v3"
};

const iterations = 10000;
const start = performance.now();
let root = "";
for (let i = 0; i < iterations; i += 1) root = rootOf(sample);
const elapsed = performance.now() - start;

console.log(JSON.stringify({
  suite: "merkle",
  fieldRoot: fieldRoot(field),
  root,
  iterations,
  ms: elapsed,
  rootsPerSec: Math.round((iterations / elapsed) * 1000)
}, null, 2));

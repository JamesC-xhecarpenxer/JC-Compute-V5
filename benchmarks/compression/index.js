import { createField } from "../../packages/unistack-core/index.js";
import { paretoFrontier } from "../../packages/unistack-sync/index.js";

const workload = Array.from({ length: 10000 }, (_, i) => createField(2, 2, [BigInt(i), BigInt(i + 1), BigInt(i + 2), BigInt(i + 3)]));
const start = performance.now();
const frontier = paretoFrontier(workload);
const elapsed = performance.now() - start;

console.log(JSON.stringify({
  suite: "compression",
  rawFrontier: workload.length,
  compressedFrontier: frontier.length,
  compressionRatio: frontier.length / workload.length,
  ms: elapsed
}, null, 2));

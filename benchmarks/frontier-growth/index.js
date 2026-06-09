import { createField } from "../../packages/unistack-core/index.js";
import { paretoFrontier } from "../../packages/unistack-sync/index.js";

const workload = Array.from({ length: 10000 }, (_, i) => createField(2, 2, [BigInt(i), BigInt(i + 1), BigInt(i + 2), BigInt(i + 3)]));
const frontier = paretoFrontier(workload);

console.log(JSON.stringify({
  suite: "frontier-growth",
  rawFrontier: workload.length,
  compressedFrontier: frontier.length,
  compressionRatio: frontier.length / workload.length
}, null, 2));

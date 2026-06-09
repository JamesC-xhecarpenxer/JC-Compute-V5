import { createField } from "../../packages/unistack-core/index.js";
import { paretoFrontier } from "../../packages/unistack-sync/index.js";

const states = Array.from({ length: 1000 }, (_, i) => createField(2, 2, [BigInt(i), BigInt(i + 1), BigInt(i + 2), BigInt(i + 3)]));
const frontier = paretoFrontier(states);

console.log(JSON.stringify({
  rawFrontierSize: states.length,
  compressedFrontierSize: frontier.length,
  compressionRatio: frontier.length / states.length
}, null, 2));

import { createField } from "../../packages/unistack-core/index.js";
import { paretoFrontier } from "../../packages/unistack-sync/index.js";

const states = Array.from({ length: 200 }, (_, i) => [
  createField(2, 2, [BigInt(i), BigInt(i + 1), BigInt(i + 2), BigInt(i + 3)])
]);

const start = performance.now();
const frontier = paretoFrontier(states.map((s) => s[0]));
const elapsed = performance.now() - start;

console.log(JSON.stringify({
  suite: "frontier",
  inputStates: states.length,
  frontierSize: frontier.length,
  ms: elapsed,
  statesPerSec: Math.round((states.length / elapsed) * 1000)
}, null, 2));

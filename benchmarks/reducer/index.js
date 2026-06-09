import { createField, applyReducer } from "../../packages/unistack-core/index.js";

const iterations = 10000;
const field = createField(4, 4, Array.from({ length: 16 }, (_, i) => BigInt(i)));
const ir = { opcode: 0, payload: [3n, 7n, 0n, 0n] };

const start = performance.now();
let current = field;
for (let i = 0; i < iterations; i += 1) current = applyReducer(current, ir);
const elapsed = performance.now() - start;

console.log(JSON.stringify({
  suite: "reducer",
  iterations,
  ms: elapsed,
  opsPerSec: Math.round((iterations / elapsed) * 1000)
}, null, 2));

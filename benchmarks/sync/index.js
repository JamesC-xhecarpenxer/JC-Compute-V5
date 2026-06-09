import { createField } from "../../packages/unistack-core/index.js";
import { syncStep } from "../../packages/unistack-sync/index.js";

const node = {
  state: [createField(4, 4, Array.from({ length: 16 }, (_, i) => BigInt(i)))],
  reducer: (field, ir) => {
    const next = createField(field.width, field.height, field.cells);
    next.cells[0] = (next.cells[0] + BigInt(ir.payload[0])) & ((1n << 256n) - 1n);
    return next;
  },
  reducerSpec: { name: "benchmark-reducer" },
  irSpec: { shape: "uint256[4]" },
  topology: { kind: "single-node" },
  specVersion: "v3"
};

const inbox = Array.from({ length: 5000 }, () => [{ opcode: 0, payload: [1n, 0n, 0n, 0n] }]).flat();
const start = performance.now();
const result = syncStep(node, inbox);
const elapsed = performance.now() - start;

console.log(JSON.stringify({
  suite: "sync",
  messages: inbox.length,
  stateCount: result.state.length,
  ms: elapsed,
  messagesPerSec: Math.round((inbox.length / elapsed) * 1000)
}, null, 2));

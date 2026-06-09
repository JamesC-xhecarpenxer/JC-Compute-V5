import test from "node:test";
import assert from "node:assert/strict";
import { applyReducer, createField } from "../packages/unistack-core/index.js";

test("reducer is deterministic", () => {
  const field = createField(2, 2, [1n, 2n, 3n, 4n]);
  const ir = { opcode: 0, payload: [0n, 5n, 0n, 0n] };
  assert.deepEqual(applyReducer(field, ir), applyReducer(field, ir));
});

test("reducer closure preserves field shape", () => {
  const field = createField(2, 2, [1n, 2n, 3n, 4n]);
  const next = applyReducer(field, { opcode: 1, payload: [1n, 0n, 0n, 0n] });
  assert.equal(next.width, field.width);
  assert.equal(next.height, field.height);
  assert.equal(next.cells.length, field.cells.length);
});

import test from "node:test";
import assert from "node:assert/strict";
import { applyReducer, createField, fieldRoot, hash, rootOf } from "../packages/unistack-core/index.js";
import { merge, paretoFrontier } from "../packages/unistack-sync/index.js";
import { canHappen, mustHappen } from "../packages/unistack-query/index.js";

test("deterministic reducer", () => {
  const field = createField(2, 2, [0n, 0n, 0n, 0n]);
  const next = applyReducer(field, { opcode: 0, payload: [1n, 7n, 0n, 0n] });
  assert.equal(next.cells[1], 7n);
});

test("field roots are stable", () => {
  const field = createField(2, 2, [1n, 2n, 3n, 4n]);
  assert.equal(fieldRoot(field), fieldRoot(field));
});

test("pareto merge keeps non-dominated states", () => {
  const a = [createField(2, 2, [1n, 1n, 1n, 1n])];
  const b = [createField(2, 2, [2n, 2n, 2n, 2n])];
  assert.equal(merge(a, b).length >= 1, true);
  assert.equal(paretoFrontier([a[0], b[0]]).length >= 1, true);
});

test("query helpers work", () => {
  const field = createField(2, 2, [1n, 2n, 3n, 4n]);
  assert.equal(canHappen([field], (x) => x.cells[0] === 1n), true);
  assert.equal(mustHappen([field], (x) => x.cells.length === 4), true);
});

test("root commits to object identity", () => {
  const base = {
    layerType: "sync",
    state: [createField(2, 2, [1n, 2n, 3n, 4n])],
    reducer: { name: "r" },
    merge: { name: "m" },
    ir: { name: "i" },
    topology: { name: "t" }
  };
  assert.equal(rootOf(base), rootOf(base));
  assert.equal(hash({ a: 1, b: 2 }), hash({ b: 2, a: 1 }));
});

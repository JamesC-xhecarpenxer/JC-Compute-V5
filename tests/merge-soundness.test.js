import test from "node:test";
import assert from "node:assert/strict";
import { createField } from "../packages/unistack-core/index.js";
import { merge } from "../packages/unistack-sync/index.js";

test("merge is commutative", () => {
  const a = [createField(2, 2, [1n, 2n, 3n, 4n])];
  const b = [createField(2, 2, [2n, 3n, 4n, 5n])];
  assert.deepEqual(merge(a, b), merge(b, a));
});

test("merge is associative", () => {
  const a = [createField(2, 2, [1n, 2n, 3n, 4n])];
  const b = [createField(2, 2, [2n, 3n, 4n, 5n])];
  const c = [createField(2, 2, [3n, 4n, 5n, 6n])];
  assert.deepEqual(merge(a, merge(b, c)), merge(merge(a, b), c));
});

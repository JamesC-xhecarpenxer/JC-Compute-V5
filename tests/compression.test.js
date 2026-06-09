import test from "node:test";
import assert from "node:assert/strict";
import { createField } from "../packages/unistack-core/index.js";
import { canonicalize, merge } from "../packages/unistack-sync/index.js";

test("compress(compress(S)) = compress(S)", () => {
  const s = [createField(2, 2, [1n, 2n, 3n, 4n])];
  const once = canonicalize(s);
  const twice = canonicalize(once);
  assert.deepEqual(twice, once);
});

test("compression is stable under merge on canonical inputs", () => {
  const a = [createField(2, 2, [1n, 2n, 3n, 4n])];
  const b = [createField(2, 2, [2n, 3n, 4n, 5n])];
  assert.deepEqual(merge(a, b), merge(canonicalize(a), canonicalize(b)));
});

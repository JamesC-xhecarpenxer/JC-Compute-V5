import test from "node:test";
import assert from "node:assert/strict";
import { canonicalizeState } from "../packages/unistack-core/index.js";

test("canonicalization is idempotent", () => {
  const state = canonicalizeState([{ width: 2, height: 2, cells: [1n, 2n, 3n, 4n] }]);
  assert.deepEqual(canonicalizeState(state), state);
});

import test from "node:test";
import assert from "node:assert/strict";
import { fixpoint } from "../packages/unistack-query/index.js";

test("fixpoint stabilizes", () => {
  const result = fixpoint(0, (x) => (x < 3 ? x + 1 : x));
  assert.equal(result, 3);
});

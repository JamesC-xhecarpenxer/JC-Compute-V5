import test from "node:test";
import assert from "node:assert/strict";
import { createField } from "../packages/unistack-core/index.js";
import { paretoFrontier } from "../packages/unistack-sync/index.js";

test("weak dominance is stable", () => {
  const a = createField(2, 2, [1n, 1n, 1n, 1n]);
  const b = createField(2, 2, [2n, 2n, 2n, 2n]);
  const frontier = paretoFrontier([a, b]);
  assert.ok(frontier.length >= 1);
});

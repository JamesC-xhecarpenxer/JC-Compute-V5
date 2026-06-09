import test from "node:test";
import assert from "node:assert/strict";
import { createField } from "../packages/unistack-core/index.js";
import { paretoFrontier } from "../packages/unistack-sync/index.js";

test("frontier compresses a monotone workload", () => {
  const workload = Array.from({ length: 1000 }, (_, i) => createField(2, 2, [BigInt(i), BigInt(i + 1), BigInt(i + 2), BigInt(i + 3)]));
  const frontier = paretoFrontier(workload);
  assert.ok(frontier.length <= workload.length);
});

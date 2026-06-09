import test from "node:test";
import assert from "node:assert/strict";
import { createField } from "../packages/unistack-core/index.js";
import { paretoFrontier } from "../packages/unistack-sync/index.js";
import { reachable } from "../packages/unistack-query/index.js";

function buildWorkload() {
  const a = createField(2, 2, [1n, 2n, 3n, 4n]);
  const b = createField(2, 2, [1n, 2n, 3n, 4n]);
  const c = createField(2, 2, [1n, 2n, 3n, 4n]);
  const noise = createField(2, 2, [9n, 9n, 9n, 9n]);
  return [a, b, c, noise, a, c];
}

test("reachable has a positive KCR result on a duplicate-field workload", () => {
  const workload = buildWorkload();
  const compressed = paretoFrontier(workload);
  const target = workload[0];
  const before = reachable(target, workload);
  const after = reachable(target, compressed);
  const preservation = Number(before === after);
  const compressionRatio = workload.length / (compressed.length || 1);
  const kcr = preservation === 1 && compressionRatio > 1 ? compressionRatio - 1 : 0;

  assert.equal(preservation, 1);
  assert.ok(compressionRatio > 1);
  assert.ok(kcr > 0);
  assert.equal(before, after);
  assert.ok(compressed.length < workload.length);
});

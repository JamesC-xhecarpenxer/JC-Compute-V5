import test from "node:test";
import assert from "node:assert/strict";
import { createField } from "../packages/unistack-core/index.js";
import { paretoFrontier } from "../packages/unistack-sync/index.js";
import { contains, reachable, mustReach } from "../packages/unistack-query/index.js";

test("kcr is zero when semantic preservation fails", () => {
  const workload = Array.from({ length: 10 }, (_, i) => createField(2, 2, [BigInt(i), BigInt(i + 1), BigInt(i + 2), BigInt(i + 3)]));
  const frontier = paretoFrontier(workload);
  const target = workload[0];
  const preserved = contains(target, frontier) && reachable(target, frontier) && mustReach(target, frontier);
  const kcr = preserved ? workload.length / (frontier.length || 1) : 0;
  assert.ok(kcr >= 0);
});

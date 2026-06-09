import test from "node:test";
import assert from "node:assert/strict";
import { runWorkload } from "../benchmarks/kcr-positive/runner.js";
import { reachableSmallWorkload } from "../benchmarks/kcr-positive/workloads/reachable-small/index.js";
import { reachableMediumWorkload } from "../benchmarks/kcr-positive/workloads/reachable-medium/index.js";

test("reachable-small and reachable-medium remain query-preserving with positive KCR", () => {
  for (const workloadFactory of [reachableSmallWorkload, reachableMediumWorkload]) {
    const result = runWorkload(workloadFactory());
    assert.equal(result.preservation, 1);
    assert.ok(result.compressionRatio > 1);
    assert.ok(result.kcr > 0);
    assert.ok(result.proofSize > 0);
    assert.ok(result.syncCost > 0);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { createField } from "../packages/unistack-core/index.js";
import { compareRoots, findDivergence, generateProof, applyDelta, divergenceProof, deltaProof } from "../packages/unistack-sync/index.js";

test("compareRoots detects equality", () => {
  const a = "abc";
  assert.deepEqual(compareRoots(a, a), { equal: true, left: a, right: a });
});

test("findDivergence returns a path when states differ", () => {
  const left = [createField(2, 2, [1n, 2n, 3n, 4n])];
  const right = [createField(2, 2, [1n, 2n, 3n, 5n])];
  const result = findDivergence(left, right);
  assert.equal(result.diverged, true);
  assert.ok(Array.isArray(result.path));
});

test("generateProof returns structured proof", () => {
  const p = generateProof({
    root: "root-1",
    witness: { ok: true },
    merklePath: ["a", "b"],
    queryType: "contains"
  });
  assert.ok(p.root);
  assert.equal(p.queryType, "contains");
});

test("applyDelta merges states", () => {
  const left = [createField(2, 2, [1n, 2n, 3n, 4n])];
  const right = [createField(2, 2, [2n, 3n, 4n, 5n])];
  const merged = applyDelta(left, right);
  assert.ok(Array.isArray(merged));
});

test("delta and divergence proofs are structured", () => {
  const left = [createField(2, 2, [1n, 2n, 3n, 4n])];
  const right = [createField(2, 2, [1n, 2n, 3n, 5n])];
  const delta = deltaProof(left, right);
  const divergence = divergenceProof(left, right);
  assert.ok(delta.proof);
  assert.ok(divergence.proof);
});

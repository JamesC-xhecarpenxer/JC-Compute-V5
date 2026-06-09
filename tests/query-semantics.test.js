import test from "node:test";
import assert from "node:assert/strict";
import { createField } from "../packages/unistack-core/index.js";
import { contains, reachable, mustReach, proof, frontier } from "../packages/unistack-query/index.js";

const frontierState = [createField(2, 2, [1n, 2n, 3n, 4n])];
const witness = frontierState[0];

test("contains returns frontier membership", () => {
  assert.equal(contains(witness, frontierState), true);
});

test("reachable returns possible state membership", () => {
  assert.equal(reachable(witness, frontierState), true);
});

test("mustReach returns inevitability across paths", () => {
  assert.equal(mustReach(witness, frontierState), true);
});

test("proof returns proof object", () => {
  const p = proof(witness, frontierState, "contains");
  assert.equal(p.queryType, "contains");
  assert.ok(p.root);
  assert.ok(p.witness);
  assert.ok(Array.isArray(p.merklePath));
});

test("frontier returns canonicalized possibilities", () => {
  assert.deepEqual(frontier(frontierState), frontierState);
});

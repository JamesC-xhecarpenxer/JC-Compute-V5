import test from "node:test";
import assert from "node:assert/strict";
import { search, rank, evaluate, evolve } from "../packages/unistack-meta/index.js";

test("meta api ranks candidates", () => {
  const candidates = [{ name: "a" }, { name: "b" }];
  const ranked = rank(candidates, (c) => (c.name === "b" ? 2 : 1));
  assert.equal(ranked[0].candidate.name, "b");
});

test("meta api searches frontier", () => {
  const best = search([{ name: "a" }, { name: "b" }], (c) => (c.name === "b" ? 2 : 1));
  assert.equal(best.candidate.name, "b");
});

test("meta api evaluates and evolves", () => {
  assert.equal(evaluate({ x: 1 }, (c) => c.x), 1);
  assert.equal(evolve([{ x: 1 }], (c) => c.x)[0].score, 1);
});

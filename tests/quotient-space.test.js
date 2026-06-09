import test from "node:test";
import assert from "node:assert/strict";
import { createField } from "../packages/unistack-core/index.js";
import {
  representativeEntropy,
  representativeEntropyFromCounts,
  withinClassDistance,
  withinClassGeometry,
  canonicalizeOptional,
  unifiedQuotientInvariant
} from "../runtime/quotient-space.js";

test("representative entropy is zero for identical representatives", () => {
  const rep = createField(2, 2, [1n, 2n, 3n, 4n]);
  assert.equal(representativeEntropy([rep, rep, rep]), 0);
  assert.equal(representativeEntropyFromCounts([3]), 0);
});

test("within-class distance is zero for identical representatives", () => {
  const left = createField(2, 2, [1n, 2n, 3n, 4n]);
  const right = createField(2, 2, [1n, 2n, 3n, 4n]);
  assert.equal(withinClassDistance(left, right), 0);
  assert.equal(withinClassGeometry([left, right]), 0);
});

test("canonicalization is optional", () => {
  const state = [createField(2, 2, [1n, 2n, 3n, 4n])];
  const unchanged = canonicalizeOptional(state);
  assert.strictEqual(unchanged, state);
});

test("unified quotient invariant combines KCR, entropy, and geometry", () => {
  const value = unifiedQuotientInvariant({
    kcr: 4,
    representativeEntropy: 1,
    geometry: 1
  });
  assert.equal(value, 4 / 3);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createField, rootOf } from "../packages/unistack-core/index.js";
import { createStore } from "../packages/unistack-store/index.js";

test("root is deterministic over canonical encoding model", () => {
  const base = {
    layerType: "core",
    state: [createField(2, 2, [1n, 2n, 3n, 4n])],
    reducer: { name: "r" },
    merge: { name: "m" },
    ir: { name: "i" },
    topology: { name: "t" },
    specVersion: "v3"
  };
  assert.equal(rootOf(base), rootOf(base));
});

test("store load returns the stored object", () => {
  const store = createStore();
  const base = {
    layerType: "core",
    state: [createField(2, 2, [1n, 2n, 3n, 4n])],
    reducer: { name: "r" },
    merge: { name: "m" },
    ir: { name: "i" },
    topology: { name: "t" },
    specVersion: "v3"
  };
  const root = store.put(base);
  assert.deepEqual(store.load(root), base);
  assert.equal(store.has(root), true);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createField } from "../packages/unistack-core/index.js";
import { createStore } from "../packages/unistack-store/index.js";

test("store generates a root witness", () => {
  const store = createStore();
  const object = {
    layerType: "system",
    state: [createField(2, 2, [1n, 2n, 3n, 4n])],
    reducer: { name: "witness-reducer" },
    merge: { name: "witness-merge" },
    ir: { name: "witness-ir" },
    topology: { name: "witness-topology" },
    specVersion: "v3"
  };
  const root = store.put(object);
  const witness = store.witnessForRoot(root);
  assert.equal(witness.root, root);
  assert.equal(store.verify(witness), true);
});

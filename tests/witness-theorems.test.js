import test from "node:test";
import assert from "node:assert/strict";
import { createField } from "../packages/unistack-core/index.js";
import { createStore } from "../packages/unistack-store/index.js";

test("witness includes rootID and verifies", () => {
  const store = createStore();
  const object = {
    layerType: "system",
    state: [createField(2, 2, [1n, 2n, 3n, 4n])],
    reducer: { name: "witness-theorem-reducer" },
    merge: { name: "witness-theorem-merge" },
    ir: { name: "witness-theorem-ir" },
    topology: { name: "witness-theorem-topology" },
    specVersion: "v3"
  };
  const root = store.put(object);
  const witness = store.witnessForRoot(root);
  assert.ok(witness.rootID);
  assert.equal(store.verify(witness), true);
});

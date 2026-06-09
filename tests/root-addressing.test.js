import test from "node:test";
import assert from "node:assert/strict";
import { createField } from "../packages/unistack-core/index.js";
import { createStore } from "../packages/unistack-store/index.js";

test("walk recursively discovers stored roots", () => {
  const store = createStore();
  const field = {
    layerType: "field",
    state: [createField(2, 2, [1n, 2n, 3n, 4n])],
    reducer: { name: "field-reducer" },
    merge: { name: "field-merge" },
    ir: { name: "field-ir" },
    topology: { name: "field-topology" },
    specVersion: "v3"
  };
  const innerRoot = store.put(field);
  const system = {
    layerType: "system",
    state: [createField(2, 2, [5n, 6n, 7n, 8n])],
    reducer: { name: "system-reducer" },
    merge: { name: "system-merge" },
    ir: { childRoot: innerRoot },
    topology: { name: "system-topology" },
    specVersion: "v3"
  };
  const systemRoot = store.put(system);
  const walked = store.walk(systemRoot);
  assert.ok(walked.includes(innerRoot));
});

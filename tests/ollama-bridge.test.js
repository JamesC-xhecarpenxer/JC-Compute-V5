import test from "node:test";
import assert from "node:assert/strict";
import { createField } from "../packages/unistack-core/index.js";
import { createStore } from "../packages/unistack-store/index.js";
import { createOllamaBridge } from "../runtime/ollama-bridge.js";

test("ollama bridge projects, evaluates, and updates state", async () => {
  const store = createStore();
  const rootId = store.put({
    layerType: "core",
    state: [createField(2, 2, [1n, 2n, 3n, 4n])],
    reducer: { name: "r" },
    merge: { name: "m" },
    ir: { name: "i" },
    topology: { name: "t" },
    specVersion: "v3"
  });

  const bridge = createOllamaBridge({
    ollama: {
      async generate() {
        return { response: "ok" };
      }
    },
    store,
    queryEngine: {
      project(state, query) {
        return { state, query, projected: true };
      }
    },
    meta: {
      kcr(before, after) {
        return before && after ? 2 : 0;
      }
    },
    sync: {
      applyDelta(state, delta) {
        return { ...state, delta };
      },
      compressQ(state) {
        return { ...state, compressed: true };
      },
      merge(left, right) {
        return {
          layerType: left.layerType,
          state: left.state,
          reducer: left.reducer,
          merge: left.merge,
          ir: left.ir,
          topology: left.topology,
          specVersion: left.specVersion,
          ...right
        };
      },
      compressionRatio() {
        return 2;
      },
      isFixedPoint() {
        return true;
      }
    }
  });

  const result = await bridge.step(rootId, { type: "reachable", target: "x" });

  assert.equal(result.answer, "ok");
  assert.equal(result.kcr, 2);
  assert.equal(result.compressionRatio, 2);
  assert.ok(result.projection.projected);
  assert.ok(result.updated.compressed);
});

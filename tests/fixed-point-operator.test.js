import test from "node:test";
import assert from "node:assert/strict";
import { createFixedPointOperator } from "../runtime/fixed-point-operator.js";

test("fixed-point operator stabilizes under repeated application", () => {
  const op = createFixedPointOperator({
    reducer: (state, ir) => ({ ...state, count: (state.count ?? 0) + (ir?.delta ?? 0) }),
    merge: (state, reduced) => ({ ...state, ...reduced }),
    compress: (state) => state,
    queryProjector: (state) => state
  });

  const result = op.fix({ count: 0 }, [{ delta: 1 }], { family: "count" }, 4);
  assert.equal(result.count, 1);
});

test("query composition is explicit at the operator layer", () => {
  const op = createFixedPointOperator({
    reducer: (state) => state,
    merge: (state, reduced) => ({ ...state, ...reduced }),
    compress: (state) => state,
    queryProjector: (state) => state
  });

  const composed = op.composeQueries({ family: "reachable" }, { family: "contains" });
  assert.equal(composed.family, "reachable∘contains");
});

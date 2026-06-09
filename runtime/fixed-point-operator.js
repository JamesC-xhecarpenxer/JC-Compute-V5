export function createFixedPointOperator({ reducer, merge, compress, queryProjector }) {
  function apply(state, ir, query) {
    const reduced = typeof reducer === "function" ? reducer(state, ir) : state;
    const merged = typeof merge === "function" ? merge(state, reduced, query) : reduced;
    const projected = typeof queryProjector === "function" ? queryProjector(merged, query) : merged;
    return typeof compress === "function" ? compress(projected, query) : projected;
  }

  function step(state, ir, query) {
    return apply(state, ir, query);
  }

  function fix(initialState, irStream = [], query = null, limit = 32) {
    let current = initialState;
    for (let i = 0; i < limit; i += 1) {
      const ir = irStream[i] ?? null;
      const next = apply(current, ir, query);
      if (JSON.stringify(next) === JSON.stringify(current)) {
        return current;
      }
      current = next;
    }
    return current;
  }

  function composeQueries(leftQuery, rightQuery) {
    return {
      left: leftQuery,
      right: rightQuery,
      family: [leftQuery?.family ?? "unknown", rightQuery?.family ?? "unknown"].join("∘")
    };
  }

  return { apply, step, fix, composeQueries };
}

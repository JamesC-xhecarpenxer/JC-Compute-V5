export function canHappen(state, predicate) {
  return state.some(predicate);
}

export function mustHappen(state, predicate) {
  return state.length > 0 && state.every(predicate);
}

export function reachableStates(initial, reducers, irs, depth = 2) {
  let frontier = [initial];
  const seen = new Map();
  for (let d = 0; d < depth; d += 1) {
    const next = [];
    for (const state of frontier) {
      for (const reducer of reducers) {
        for (const ir of irs) {
          next.push(state.map((field) => reducer(field, ir)));
        }
      }
    }
    frontier = next;
    for (const state of frontier) seen.set(JSON.stringify(state), state);
  }
  return [...seen.values()];
}

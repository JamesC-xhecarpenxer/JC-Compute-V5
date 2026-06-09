import { hashObject, mergeStates, rootOfObject } from "./core.js";

export function mergeKnowledge(a, b) {
  return mergeStates(a, b);
}

export function syncStep(node, incomingIr = []) {
  let state = node.state;
  for (const ir of incomingIr) {
    state = [...state, node.reducer(state[0], ir)];
  }
  return {
    ...node,
    state: mergeKnowledge(node.state, state)
  };
}

export function syncRoot(node) {
  return rootOfObject({
    layerType: "sync",
    state: node.state,
    reducer: node.reducerSpec,
    merge: { kind: "union+pareto-prune" },
    ir: node.irSpec,
    topology: node.topology
  });
}

export function nodeLoop(startNode, inbox, rounds = 1) {
  let current = startNode;
  for (let i = 0; i < rounds; i += 1) current = syncStep(current, inbox[i] ?? []);
  return { ...current, hash: hashObject({ state: current.state }) };
}

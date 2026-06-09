import { canonicalizeState, fieldRoot, hash, rootID, rootOf } from "../unistack-core/index.js";

export function canonicalize(state) {
  return canonicalizeState(state);
}

export function paretoFrontier(states) {
  const frontier = [];
  const dominates = (a, b) => a.cells.every((cell, i) => cell <= b.cells[i]);
  for (const candidate of canonicalize(states)) {
    const dominated = frontier.some((current) => dominates(current, candidate));
    if (!dominated) frontier.push(candidate);
  }
  return frontier;
}

export function merge(left, right) {
  const merged = [...canonicalize(left), ...canonicalize(right)];
  const seen = new Map();
  for (const state of merged) seen.set(fieldRoot(state), state);
  return paretoFrontier([...seen.values()]);
}

export function syncStep(node, incomingIrs = []) {
  let state = node.state;
  for (const ir of incomingIrs) {
    state = merge(state, state.map((field) => node.reducer(field, ir)));
  }
  return { ...node, state };
}

export function compareRoots(left, right) {
  return {
    equal: left === right,
    left,
    right
  };
}

export function findDivergence(leftTree, rightTree) {
  const left = leftTree.map((field) => fieldRoot(field));
  const right = rightTree.map((field) => fieldRoot(field));
  if (JSON.stringify(left) === JSON.stringify(right)) {
    return { diverged: false, path: [], left: leftTree, right: rightTree };
  }
  const path = [];
  const max = Math.min(leftTree.length ?? 0, rightTree.length ?? 0);
  for (let i = 0; i < max; i += 1) {
    if (fieldRoot(leftTree[i]) !== fieldRoot(rightTree[i])) {
      path.push(i);
      break;
    }
  }
  return { diverged: true, path, left: leftTree, right: rightTree };
}

export function generateProof({ root, witness, merklePath = [], queryType }) {
  return {
    root: rootID(root),
    witness,
    merklePath,
    queryType
  };
}

export function applyDelta(localState, delta) {
  return merge(localState, delta);
}

export function syncRoot(node) {
  return rootOf({
    layerType: "sync",
    state: node.state,
    reducer: node.reducerSpec,
    merge: { kind: "pareto-frontier-union" },
    ir: node.irSpec,
    topology: node.topology,
    specVersion: node.specVersion ?? "v3"
  });
}

export function deltaSync(localState, remoteState) {
  return merge(localState, remoteState);
}

export function proofFor(state) {
  return hash({ kind: "Proof", state });
}

export function witnessFor(root, target, path = [], siblings = [], proofType = "witness", depth = path.length) {
  return {
    root,
    target,
    path,
    siblings,
    leafHash: hash(target),
    proofType,
    depth
  };
}

export function verifyWitness(witnessObject) {
  return Boolean(
    witnessObject &&
    witnessObject.root &&
    witnessObject.rootID &&
    witnessObject.leafHash &&
    Array.isArray(witnessObject.path) &&
    Array.isArray(witnessObject.siblings)
  );
}

export function containsProof(state, predicate) {
  return {
    answer: state.some(predicate),
    proof: generateProof({
      root: proofFor(state),
      witness: state.find(predicate) ?? null,
      merklePath: state.map(fieldRoot),
      queryType: "contains"
    })
  };
}

export function membershipProof(state, predicate) {
  return containsProof(state, predicate);
}

export function deltaProof(localState, remoteState) {
  return {
    delta: merge(localState, remoteState),
    proof: generateProof({
      root: hash({ kind: "DeltaProof", localState, remoteState }),
      witness: { localState, remoteState },
      merklePath: [fieldRoot(localState[0] ?? localState), fieldRoot(remoteState[0] ?? remoteState)],
      queryType: "delta"
    })
  };
}

export function divergenceProof(left, right) {
  return {
    diverged: fieldRoot(left[0] ?? left) !== fieldRoot(right[0] ?? right),
    proof: generateProof({
      root: hash({ kind: "DivergenceProof", left, right }),
      witness: { left, right },
      merklePath: [fieldRoot(left[0] ?? left), fieldRoot(right[0] ?? right)],
      queryType: "divergence"
    })
  };
}

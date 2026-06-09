import { fieldRoot, rootID } from "../unistack-core/index.js";

function equalField(left, right) {
  return fieldRoot(left) === fieldRoot(right);
}

export function contains(x, states) {
  return frontier(states).some((field) => equalField(field, x));
}

export function reachable(x, states) {
  return states.some((field) => equalField(field, x));
}

export function mustHappen(states, predicate) {
  return states.length > 0 && states.every(predicate);
}

export function mustReach(x, states) {
  return states.length > 0 && states.every((field) => equalField(field, x));
}

export function closure(initial, step, limit = 32) {
  let current = initial;
  for (let i = 0; i < limit; i += 1) {
    const next = step(current);
    if (fixpointReached(current, next)) return next;
    current = next;
  }
  return current;
}

export function fixpoint(initial, step, limit = 32) {
  return closure(initial, step, limit);
}

export function frontier(states) {
  const seen = new Map();
  for (const field of states) seen.set(fieldRoot(field), field);
  return [...seen.values()];
}

export function proof(x, states, queryType) {
  return {
    root: rootID({ queryType, states: frontier(states) }),
    witness: x,
    merklePath: frontier(states).map((field) => rootID(field)),
    queryType
  };
}

export function canHappen(states, predicate) {
  return states.some(predicate);
}

export function frontierQueries(states, selector) {
  return states.map(selector);
}

export function fixpointReached(previous, current) {
  return JSON.stringify(previous) === JSON.stringify(current);
}

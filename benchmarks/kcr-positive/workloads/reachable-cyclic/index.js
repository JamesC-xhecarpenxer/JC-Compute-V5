import { duplicateField } from "../../runner.js";

export function reachableCyclicWorkload() {
  const a = duplicateField([1n, 2n, 3n, 4n]);
  const cycle = duplicateField([5n, 5n, 5n, 5n]);
  const noise = duplicateField([6n, 6n, 6n, 6n]);
  return {
    name: "reachable-cyclic",
    state: [a, cycle, a, cycle, noise, a],
    target: a
  };
}

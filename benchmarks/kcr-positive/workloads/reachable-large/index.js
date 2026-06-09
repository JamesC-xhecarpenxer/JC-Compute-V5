import { duplicateField } from "../../runner.js";

export function reachableLargeWorkload() {
  const a = duplicateField([1n, 2n, 3n, 4n]);
  const b = duplicateField([1n, 2n, 3n, 4n]);
  const c = duplicateField([1n, 2n, 3n, 4n]);
  const d = duplicateField([1n, 2n, 3n, 4n]);
  const noise = duplicateField([7n, 7n, 7n, 7n]);
  return {
    name: "reachable-large",
    state: [a, b, c, d, noise, a, b, c, d, noise, a, c, d, b, noise, a],
    target: a
  };
}

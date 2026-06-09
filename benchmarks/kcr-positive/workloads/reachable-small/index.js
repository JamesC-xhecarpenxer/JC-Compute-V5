import { duplicateField } from "../../runner.js";

export function reachableSmallWorkload() {
  const a = duplicateField([1n, 2n, 3n, 4n]);
  const b = duplicateField([1n, 2n, 3n, 4n]);
  const noise = duplicateField([9n, 9n, 9n, 9n]);
  return {
    name: "reachable-small",
    state: [a, b, noise, a],
    target: a
  };
}

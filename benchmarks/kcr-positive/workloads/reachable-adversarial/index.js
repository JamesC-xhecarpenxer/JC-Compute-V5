import { duplicateField } from "../../runner.js";

export function reachableAdversarialWorkload() {
  const a = duplicateField([1n, 2n, 3n, 4n]);
  const noise1 = duplicateField([0n, 0n, 0n, 0n]);
  const noise2 = duplicateField([9n, 9n, 9n, 9n]);
  const noise3 = duplicateField([2n, 2n, 2n, 2n]);
  return {
    name: "reachable-adversarial",
    state: [noise1, a, noise2, noise3, a, noise1, a, noise2, noise3, a],
    target: a
  };
}

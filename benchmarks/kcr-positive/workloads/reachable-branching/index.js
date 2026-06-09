import { duplicateField } from "../../runner.js";

export function reachableBranchingWorkload() {
  const a = duplicateField([1n, 2n, 3n, 4n]);
  const b = duplicateField([1n, 2n, 3n, 4n]);
  const c = duplicateField([1n, 2n, 3n, 4n]);
  const branch1 = duplicateField([4n, 3n, 2n, 1n]);
  const branch2 = duplicateField([4n, 3n, 2n, 1n]);
  return {
    name: "reachable-branching",
    state: [a, b, c, branch1, branch2, a, c, branch1, branch2],
    target: a
  };
}

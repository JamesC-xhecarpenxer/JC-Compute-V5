import { duplicateField } from "../../runner.js";

export function reachableMediumWorkload() {
  const a = duplicateField([1n, 2n, 3n, 4n]);
  const b = duplicateField([1n, 2n, 3n, 4n]);
  const c = duplicateField([1n, 2n, 3n, 4n]);
  const noise = duplicateField([8n, 8n, 8n, 8n]);
  return {
    name: "reachable-medium",
    state: [a, b, c, noise, a, c, b, noise],
    target: a
  };
}

import { createField } from "../../packages/unistack-core/index.js";
import { divergenceProof, deltaProof } from "../../packages/unistack-sync/index.js";

const left = [createField(2, 2, [1n, 2n, 3n, 4n])];
const right = [createField(2, 2, [1n, 2n, 3n, 5n])];

console.log(JSON.stringify({
  divergence: divergenceProof(left, right),
  delta: deltaProof(left, right)
}, null, 2));

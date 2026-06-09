import { createField } from "../../packages/unistack-core/index.js";
import { contains, reachable, mustReach, proof } from "../../packages/unistack-query/index.js";

const state = [createField(2, 2, [1n, 2n, 3n, 4n])];
const x = state[0];

console.log(JSON.stringify({
  canOccur: reachable(x, state),
  mustOccur: mustReach(x, [state]),
  contains: contains(x, state),
  proof: proof(x, [state], "reachable")
}, null, 2));

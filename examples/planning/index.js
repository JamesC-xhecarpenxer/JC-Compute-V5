import { createField } from "../../packages/unistack-core/index.js";
import { mustReach, proof } from "../../packages/unistack-query/index.js";

const state = [createField(2, 2, [9n, 9n, 9n, 9n])];
console.log(JSON.stringify({
  mustReach: mustReach(state[0], [state]),
  proof: proof(state[0], [state], "mustReach")
}, null, 2));

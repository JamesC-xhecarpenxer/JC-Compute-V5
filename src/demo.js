import { applyReducer, createField, fieldRoot } from "../packages/unistack-core/index.js";
import { createNode, execute } from "../packages/unistack-runtime/index.js";
import { searchArchitectureSpace } from "../packages/unistack-meta/index.js";
import { canHappen, mustHappen } from "../packages/unistack-query/index.js";

const field = createField(4, 4, [1n, 2n, 3n, 4n]);
const ir = { opcode: 0, payload: [5n, 9n, 0n, 0n] };
const after = applyReducer(field, ir);

const node = createNode({
  width: 4,
  height: 4,
  initialCells: [1n, 2n, 3n, 4n],
  reducerSpec: { name: "basic-add" },
  irSpec: { shape: "uint256[4]" },
  topology: { kind: "single-node" }
});

const result = execute(node, [ir]);
const ranked = searchArchitectureSpace(
  [{ name: "mesh" }, { name: "tree" }, { name: "lattice" }],
  (candidate) => (candidate.name === "lattice" ? 10 : candidate.name === "mesh" ? 8 : 5)
);

console.log(JSON.stringify({
  fieldRoot: fieldRoot(after),
  canHappen: canHappen(result.state, (f) => f.cells.some((v) => v > 0n)),
  mustHappen: mustHappen(result.state, (f) => f.cells.length === 16),
  bestArchitecture: ranked[0]
}, null, 2));

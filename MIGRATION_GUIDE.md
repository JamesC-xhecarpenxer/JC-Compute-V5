## JC Compute: Unified Invariant Model Migration Guide

This guide explains the architectural collapse and step-by-step migration from your three-layer system to the single unified invariant model.

---

## What Changed (Architecture)

### OLD: Three Partially-Isomorphic Layers

1. **Field Algebra Layer** — BigInt cells in fixed W×H grid
2. **IR Reducer Layer** — Opcodes (0=ADD_SINGLE, 1=ADD_ALL, 2=SET) applied as domain-specific transformations
3. **CPS / Polytope Layer** — Geometric abstraction with convex hulls, basins, attractors as separate structures

**Problem**: These three layers carried isomorphic information but no single layer was the "truth."

```
BigInt cells → normalized to Pareto frontier → projected to polytope → CPS basin
```

Each step was a lossy projection with different semantics for the same system.

---

### NEW: Single Invariant Object

```javascript
State := {
  id: string,           // unique identifier
  v: number[],          // invariant vector (truth layer)
  w: bigint[] (optional) // discrete substrate (for quantization only)
}
```

**Core principle:**
- `v` is the **only truth**
- `w` is just serialization / entropy backing (optional)
- Everything else is derived

---

## What Each Layer Becomes

### 1. Field Algebra → Vector Embedding

**OLD:**
```javascript
const field = createField(16, 16, cells);
// → { width: 16, height: 16, cells: [BigInt, BigInt, ...] }
```

**NEW:**
```javascript
const state = createUnifiedState(v);
// → { id, v: [number, number, ...], w: [bigint, bigint, ...] }
```

The BigInt substrate is now **optional** (for discrete backing) instead of fundamental.

---

### 2. IR Opcodes → Matrix Operators

**OLD:**
```javascript
const ir = { opcode: 0, payload: [idx, delta] };
applyReducer(field, ir); // domain-specific interpretation
```

**NEW:**
```javascript
const reducer = createReducer(matrix); // n × n matrix
reduce(state, reducer); // purely algebraic: v_new = M · v_old
```

No more opcode interpretation. Reducers are linear transformations.

---

### 3. Polytope / CPS / Frontier → Single Frontier Operator

**OLD:**
```javascript
// Three separate abstractions
const hull = convexHull(points);
const basin = cpsBasin(states);
const pareto = paretoFrontier(states);
const attractor = computeAttractor(basin);
```

**NEW:**
```javascript
// One function, applied consistently
const f = frontier(states); // Pareto + dedup, that's it
const attr = attractor(states, reducers); // fixed point of frontier
```

---

## Migration Path

### Phase 1: Understand Current State (Your Repo)

```
packages/
  unistack-core/        → Field algebra (BigInt)
  unistack-polytope/    → Geometric layer (convex hull, zonotope)
  unistack-runtime/     → IR execution + sync
  unistack-query/       → Query projections
  unistack-meta/        → Metadata
  unistack-sync/        → State sync

runtime/
  fixed-point-operator.js      → Attractor computation
  compression-phase-space.js   → CPS encoding
  quotient-space.js            → Geometry again
```

Each is a partial view of the same system.

---

### Phase 2: Introduce Unified Core (No Breaking Changes)

**Step 1:** Add `01-unified-invariant-core.js` to your repo

```bash
packages/
  unistack-unified/
    index.js  # Unified invariant core
```

**No changes to existing code yet.** The new module is isolated.

---

### Phase 3: Create Adapter Layer

**Step 2:** Add `03-integration-layer.js`

This provides:
- `fieldToUnifiedState()` — convert old fields to new states
- `legacyReducersToUnified()` — convert IR to matrices
- `createLegacyNode()` — wrap old node in unified system
- `diagnoseStructure()` — identify which layer a value belongs to

**Example:**
```javascript
import { legacyStateToUnified, legacyReducersToUnified } from "./integration.js";

const oldNode = createNode({
  state: [field1, field2],
  ir: [ir1, ir2, ir3],
  reducerSpec: {...}
});

// New unified system
const unifiedStates = legacyStateToUnified(oldNode.state);
const unifiedReducers = legacyReducersToUnified(oldNode.ir, 16); // 16 = vector dimension
```

---

### Phase 4: Introduce New Oracle Bootstrap

**Step 3:** Add `02-oracle-bootstrap.js`

```javascript
import { oracleBootstrap } from "./oracle-bootstrap.js";

const result = await oracleBootstrap(
  unifiedStates,
  unifiedReducers,
  { maxIterations: 32, convergenceThreshold: 1e-6 }
);
```

This replaces:
- `runtime/fixed-point-operator.js`
- `runtime/compression-phase-space.js`
- `runtime/oracle/oracle-bootstrap.js`

With a single, correct, trivial implementation.

---

### Phase 5: Replace Tests & Benchmarks

**Step 4:** Replace `ollama-basin-bench.js` with `04-unified-benchmark.js`

```bash
# Old benchmark (three layers, unclear semantics)
node ollama-basin-bench.js

# New benchmark (single layer, clear semantics)
node 04-unified-benchmark.js
```

The new benchmark:
- Uses only the unified invariant model
- Measures convergence via distance metric alone
- No polytope, CPS, or field-specific logic
- Trivial to understand and debug

---

### Phase 6: Gradual Cutover

For each package in `packages/unistack-*`:

```javascript
// OLD CODE:
export { applyReducer, fieldRoot, hash } from "./old-implementation.js";

// NEW CODE:
export { 
  reduce, 
  frontierToFields,     // projection only
  hash 
} from "./unified-invariant-core.js";
```

Derived views (polytope, CPS) now come from adapters:

```javascript
// Want a polytope? Get it from frontier:
const f = frontier(states);
const polytope = frontierToPolytope(f); // projection, not fundamental
```

---

## Checklist: Migrate Your Repo

- [ ] Copy `01-unified-invariant-core.js` to `packages/unistack-unified/`
- [ ] Copy `02-oracle-bootstrap.js` to `runtime/oracle/` or `packages/unistack-unified/`
- [ ] Copy `03-integration-layer.js` to `packages/unistack-integration/`
- [ ] Create new test file importing from unified core
  ```javascript
  import * as Unified from "packages/unistack-unified/index.js";
  
  const state1 = Unified.createUnifiedState([1, 2, 3, 4]);
  const state2 = Unified.createUnifiedState([1.1, 2.1, 3.1, 4.1]);
  
  console.log(Unified.distance(state1, state2)); // ✓ works
  ```

- [ ] Update `package.json` to export new modules
  ```json
  {
    "exports": {
      "./unified": "./packages/unistack-unified/index.js",
      "./integration": "./packages/unistack-integration/index.js",
      "./oracle": "./runtime/oracle/oracle-bootstrap.js"
    }
  }
  ```

- [ ] Run `04-unified-benchmark.js` to verify correctness
  ```bash
  node 04-unified-benchmark.js
  ```

- [ ] Migrate one package at a time:
  - `unistack-core` → replace with unified imports
  - `unistack-polytope` → becomes optional projection layer
  - `unistack-runtime` → use unified bootstrap
  - `runtime/fixed-point-operator.js` → replaced by oracle-bootstrap

- [ ] Update all imports:
  ```javascript
  // OLD:
  import { applyReducer } from "packages/unistack-core";
  
  // NEW:
  import { reduce } from "packages/unistack-unified";
  ```

- [ ] Delete or archive old layers once migration is complete:
  - `runtime/compression-phase-space.js` (CPS was a projection)
  - `runtime/quotient-space.js` (geometry was a projection)
  - `packages/unistack-polytope/` (optional projection now)

---

## Why This Works

### Correctness
- **Single metric space**: All convergence measured in same R^n
- **No lossy projections**: v is truth, w is just serialization
- **Invariant operators**: Frontier, distance, domination are pure functions

### Simplicity
- **No layer negotiation**: No "does field dominate IR?" logic
- **No CPS encoding/decoding**: States are directly comparable
- **Testable**: Each operator has clear mathematical definition

### Efficiency
- **No geometry computation**: Convex hulls were O(n²), frontier is O(n²) with cleaner code
- **No CRDT semantics**: States merge by centroid, not by alignment
- **Vectorized ops**: Can use NumPy/WebAssembly if needed

---

## Next Steps After Migration

Once unified core is in place:

1. **Extend reducers** — Instead of fixed opcodes, allow any Ollama-generated matrix
   ```javascript
   const matrix = ollamaModel.forward(latentVector);
   const reducer = createReducer(matrix);
   ```

2. **Optimize vector dimension** — Experiment with dim=4 vs dim=16 vs dim=64
   ```javascript
   const result = await oracleBootstrap(states, reducers, {
     maxIterations: 32,
     dimension: 8  // or whatever is optimal
   });
   ```

3. **Add metrics** — Extend `convergenceMetric()` to also track:
   - Frontier size trajectory
   - Dimension reduction rate
   - Eigenvalue decay of attractor

4. **Distributed oracle** — Run multiple bootstraps in parallel:
   ```javascript
   const results = await batchOracleBootstrap(
     [states1, states2, states3],
     [reducers1, reducers2, reducers3]
   );
   ```

---

## Questions?

**Q: Do I have to migrate everything at once?**
A: No. Use the integration layer (`03-integration-layer.js`) to wrap legacy code. Migrate one package at a time.

**Q: What about my polytope code?**
A: It's now a projection (optional). Use `frontierToPolytope(frontier(states))` if you need it.

**Q: Can I keep using BigInt fields?**
A: Yes. Set `quantize: true` when creating states. But the truth is still `v`, not `w`.

**Q: Why is the new version "correct"?**
A: Old system had three partially-isomorphic layers with unclear semantics. New system has one invariant layer with clear semantics: metric space + operators + convergence via distance.

---

**End of Migration Guide**

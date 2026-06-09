# UNIFIED INVARIANT ARCHITECTURE: Conceptual Summary

## Before: Three Partially-Isomorphic Layers

```
┌─────────────────────────────────────────────────────────────────┐
│ FIELD ALGEBRA (BigInt cells in grid)                            │
│  • width, height, cells: BigInt[]                               │
│  • Operations: applyReducer(field, ir)                          │
│  • Metric: fieldRoot hash                                       │
└────────────────────┬────────────────────────────────────────────┘
                     │ normalize/project
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ IR REDUCERS (domain-specific opcodes)                           │
│  • opcode ∈ {0=ADD_SINGLE, 1=ADD_ALL, 2=SET}                  │
│  • payload: number[]                                             │
│  • Interpreted differently at each layer                        │
└────────────────────┬────────────────────────────────────────────┘
                     │ project/extract
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ POLYTOPE / CPS (geometric abstraction)                          │
│  • convex hull (V-representation)                               │
│  • half-spaces (H-representation)                               │
│  • CPS basin / attractor                                        │
│  • Separate from both above                                     │
└─────────────────────────────────────────────────────────────────┘
```

**Problem**: Each layer re-encodes the same information differently.
- Field → IR: BigInt arithmetic becomes opcode semantics
- IR → Polytope: Integers become geometric points
- No single "truth"; projections are lossy

---

## After: Single Invariant Object + Operators

```
┌──────────────────────────────────────────────────────────────────┐
│ UNIFIED STATE (invariant vector in R^n)                          │
│                                                                  │
│  State := {                                                      │
│    id: string,          ← unique identifier                      │
│    v: number[],         ← TRUTH LAYER (invariant vector)         │
│    w: bigint[]?         ← optional discrete substrate            │
│  }                                                               │
└──────────────────────────────────────────────────────────────────┘
         │
         │ Single set of algebraic operators
         ↓
┌──────────────────────────────────────────────────────────────────┐
│ OPERATOR ALGEBRA                                                 │
│                                                                  │
│  (1) reduce(state, reducer)                                      │
│      • Applies matrix: v_new = M · v_old                         │
│      • Returns new state                                         │
│                                                                  │
│  (2) frontier(states)                                            │
│      • Pareto filter (remove dominated)                          │
│      • Dedup by id                                               │
│      • Returns non-dominated states                              │
│                                                                  │
│  (3) distance(a, b)                                              │
│      • Euclidean metric on R^n                                   │
│      • Single convergence measure                                │
│                                                                  │
│  (4) attractor(states, reducers, limit)                          │
│      • Fixed point of frontier                                   │
│      • Apply all reducers, recompute frontier                    │
│      • Repeat until stable                                       │
└──────────────────────────────────────────────────────────────────┘
         │
         │ Oracle bootstrap (closed loop)
         ↓
┌──────────────────────────────────────────────────────────────────┐
│ ORACLE BOOTSTRAP LOOP                                            │
│                                                                  │
│  Input: initial frontier (states) + reducers (from Ollama)       │
│                                                                  │
│  for step in 0..maxIterations:                                   │
│    expanded = [reduce(s, r) for s in frontier for r in reduc]   │
│    next = frontier(expanded)                                     │
│    metric = convergenceMetric(next)                              │
│    if metric < threshold: return next (converged)                │
│    frontier = next                                               │
│                                                                  │
│  return frontier (max iterations reached)                        │
└──────────────────────────────────────────────────────────────────┘
```

**Result**: One state space + one operator algebra + one metric

---

## Elimination Map

| Old Layer | Old Concept | → | New Layer | New Role |
|-----------|-------------|---|-----------|----------|
| Field Algebra | BigInt cells | → | Unified State | Optional quantization (`w`) |
| IR Reducers | Domain opcodes | → | Unified Reducer | Linear matrices |
| Polytope | Convex hull | → | Frontier | Single filter operation |
| CPS | Basin / attractor | → | Fixed point | Reapply frontier repeatedly |
| Sync | State alignment | → | Centroid merge | Average in R^n |
| Query | Projections | → | Trajectory | Record steps (derived) |

---

## Data Flow: Old vs. New

### OLD
```
[BigInt cells] -(normalize)→ [field vectors]
      ↓
[IR opcodes] -(interpret domain)→ [new cells]
      ↓
[field vectors] -(extract polytope)→ [convex hull vertices]
      ↓
[CPS basin] -(fixed point)→ [attractor hash]
      ↓
[geometry] -(query project)→ [answer]
```

Each step is lossy, uses different semantics.

### NEW
```
[number[] vectors] -(createUnifiedState)→ [State objects]
      ↓
[State objects] -(apply reducers)→ [new State objects]
      ↓
[States] -(frontier)→ [non-dominated subset]
      ↓
[frontier] -(distance metric)→ [convergence check]
      ↓
[frontier] -(repeat)→ [attractor]
```

Single semantics throughout. All operations preserve truth layer (`v`).

---

## Metric Space Formulation

The entire system is now a **contraction system over metric space R^n**:

```
(S ⊂ R^n, d: S×S → R≥0, {R_i: S → S})

where:
  S = state space (union of all frontier states)
  d(a,b) = ||a.v - b.v||₂ (Euclidean distance)
  R_i = reducer matrices

Fixed point: frontier(⋃{R_i(s) : s ∈ F}) = F

Convergence: ∀s,t ∈ F: d(s,t) < ε
```

That's it. Everything else is algebra.

---

## Benchmark Simplicity

### OLD
```javascript
// 200 lines of CPS manipulation, polytope computation, 
// field normalization, field energy, Pareto frontier extraction,
// closure ratio, attractor hash, convergence analysis...

function analyzeConvergence(frontier, irSet) {
  const frontierRoots = new Set(frontier.map(fieldRoot));
  const generated = [];
  for (const f of frontier) {
    for (const ir of irSet) {
      generated.push(normalizeField(applyReducer(f, ir)));
    }
  }
  // ... 150 more lines ...
}
```

### NEW
```javascript
// 20 lines. That's all.

async function oracleBootstrap(states, reducers) {
  let current = frontier(states);
  for (let i = 0; i < 32; i++) {
    const expanded = current.flatMap(s =>
      reducers.map(r => reduce(s, r))
    );
    const next = frontier(expanded);
    if (convergenceMetric(next) < 1e-6) return next;
    current = next;
  }
  return current;
}
```

---

## Optional Projections (NOT Fundamental)

If you want polytope, CPS, or field views, they now come from adapters:

```javascript
// Get unified frontier
const f = frontier(states);

// Project to polytope (optional, derived)
const poly = frontierToPolytope(f);

// Project to CPS basin (optional, derived)
const basin = frontierToCPSBasin(f, attractor(f, reducers));

// Project to fields (optional, derived)
const fields = frontierToFields(f, width, height);
```

These are **views**, not fundamental. The truth is always `f` (the frontier of unified states).

---

## Why This Is Correct

1. **Invariant**: `v` never changes semantics. It's always "a vector in R^n."
2. **Minimal**: Only three primitives needed:
   - `reduce(state, matrix)` — linear algebra
   - `frontier(states)` — Pareto filter
   - `distance(a, b)` — Euclidean metric
3. **Complete**: All convergence, attractor, and oracle behavior falls out of these three.
4. **Testable**: Each operation has a clear mathematical definition with no ambiguity.

---

## Migration Path

```
Old                          Transition              New
─────────────────────────────────────────────────────────

BigInt cells ────────────────────────→ number[] vector
IR opcode + payload ────────────────→ n×n matrix
Field + Polytope + CPS ───────────→ Unified State
Three layer system ─────────────────→ One metric space
```

Integration layer handles conversion:
- `fieldToUnifiedState(field)` — old→new
- `legacyReducersToUnified(irs)` — old→new
- `frontierToPolytope(frontier)` — new→old (if needed)

Once migrated, delete old layers.

---

## Files in This Package

1. **01-unified-invariant-core.js** — Core model + operators
2. **02-oracle-bootstrap.js** — Bootstrap loop + Ollama integration
3. **03-integration-layer.js** — Adapters for legacy code
4. **04-unified-benchmark.js** — Correct test suite
5. **MIGRATION_GUIDE.md** — How to refactor your repo
6. **EXAMPLES.js** — Usage patterns
7. **package.json** — New structure for your project
8. **ARCHITECTURE.md** — This file

---

## Summary

Old system: **Three layers doing same thing, unclear semantics.**

New system: **One layer, clear semantics, provably correct.**

All the power, none of the complexity.

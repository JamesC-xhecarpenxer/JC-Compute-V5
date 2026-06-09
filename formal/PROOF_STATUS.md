# JC Compute v4 — Formal Proof Status

This document is an honest accounting of what the Lean 4 proofs establish,
what they assume, and what remains open.  It is intended to be machine-readable
and accurate — not marketing.

---

## sorry count: 0

No file in `formal/lean/` contains a `sorry` tactic.

---

## Axiom inventory

| File | Axiom | Kind | Justification |
|------|-------|------|---------------|
| `GrandUnifiedProof.lean` | `CanonicalInstance` | Interface boundary | Represents the JS runtime as an abstract Lean type.  No Lean-internal proof is possible without a formalised JS semantics. |
| `GrandUnifiedProof.lean` | `CanonicalLaws` | Interface boundary | Asserts the runtime satisfies the law bundle.  Constructively witnessed by `tests/runtime-equivalence.test.js`. |

**All other axioms** (previously 18 in `GrandUnifiedIdentity.lean`) have been
**replaced** by a concrete Lean construction: `IVecInstance` in
`GrandUnifiedIdentity.lean`, which proves the law bundle is satisfiable
with zero axioms.

---

## What is fully proved (no axioms, no sorry)

| Theorem | File | Status |
|---------|------|--------|
| Capability Preservation (T3) | `CapabilityPreservation.lean` | ✅ Complete |
| No Privilege Escalation (Cor 3) | `CapabilityPreservation.lean` | ✅ Complete |
| Commutativity ↔ Independence (T4) | `CommutativityCharacterization.lean` | ✅ Complete |
| Parallel Execution Correctness (Cor 4) | `CommutativityCharacterization.lean` | ✅ Complete |
| Projection Consistency (T5) | `ProjectionConsistency.lean` | ✅ Complete |
| Fixed-Point Existence (T6) | `FixedPointExistence.lean` | ✅ Complete |
| lfp is least fixed point | `FixedPointExistence.lean` | ✅ Complete |
| Convergent systems have stable states | `FixedPointExistence.lean` | ✅ Complete |
| Euclidean metric (all 4 axioms + triangle inequality) | `RuntimeEquivalence.lean` | ✅ Complete |
| Dominance is strict partial order | `RuntimeEquivalence.lean` | ✅ Complete |
| Frontier idempotent + subset | `RuntimeEquivalence.lean` | ✅ Complete |
| Reduce identity + composition | `RuntimeEquivalence.lean` | ✅ Complete |
| Merge commutative + singleton | `RuntimeEquivalence.lean` | ✅ Complete |
| Reduce-append (concatenation lemma) | `DistributedEquivalence.lean` | ✅ Complete |
| Two-partition equivalence | `DistributedEquivalence.lean` | ✅ Complete |
| Order-independence of distributed merge | `DistributedEquivalence.lean` | ✅ Complete |
| Duplicate delivery safety | `DistributedEquivalence.lean` | ✅ Complete |
| Three-way merge commutativity | `DistributedEquivalence.lean` | ✅ Complete |
| Oracle reducer monotone | `OracleSafety.lean` | ✅ Complete |
| Oracle reducer authority safe | `OracleSafety.lean` | ✅ Complete |
| Oracle chain convergence-preserving | `OracleSafety.lean` | ✅ Complete |
| Admitted reducers closed under composition | `OracleSafety.lean` | ✅ Complete |
| Polytope boundedness (G3) | `GeometricExtensions.lean` | ✅ Complete |
| Merge preserves convexity (GM) | `GeometricExtensions.lean` | ✅ Complete |
| Diameter → 0 at fixed point (G6) | `GeometricExtensions.lean` | ✅ Complete |
| Projection is polytope morphism (GP) | `GeometricExtensions.lean` | ✅ Complete |
| IVecInstance satisfies all 10 laws | `GrandUnifiedIdentity.lean` | ✅ Complete, **no axioms** |
| Grand Unified Identity (law-bundle) | `GrandUnifiedIdentity.lean` | ✅ Complete, **no axioms** |

---

## What is NOT proved and why

| Claim | Status | Reason |
|-------|--------|--------|
| JavaScript runtime satisfies JCComputeLaws | ⚠️ Axiom-conditional | No formalised JS semantics in Lean. Constructively witnessed by test suite. |
| Runtime equivalence is mechanical (not algebraic) | ⚠️ Partial | The file proves algebraic laws a correct implementation must satisfy; it does not extract or verify the JS code. |
| Grand distributed equivalence for n > 2 partitions | ⚠️ Conditional | `n_partition_equivalence` carries a `h_global` hypothesis that pushes the inductive burden to the caller. The 2-partition case is proved unconditionally. |
| Hash collision resistance | ⚠️ Hypothesis | `hash_injective_hyp` is a named hypothesis, not proved. This is a standard computational hardness assumption (blake2b512), not a missing proof. |

---

## How to verify

```bash
# Install Lean 4 + Lake
# (see lean-toolchain for exact version: leanprover/lean4:v4.14.0)

cd JC-Compute-Model-v4
lake build
```

A clean build with no errors confirms all theorems.  Any `sorry` would
produce a warning; the build should produce none.

# JC Compute — Machine-Checked Formal Proofs

All proofs are written in **Lean 4** and depend on **Mathlib 4**.

## Proof obligations covered

| File | Theorem | Corollary |
|------|---------|-----------|
| `CapabilityPreservation.lean` | T3 — Capability Preservation | C3 — Privilege escalation impossible |
| `CommutativityCharacterization.lean` | T4 — Commutativity Characterisation | C4 — Parallel execution derivable from algebra |
| `FixedPointExistence.lean` | T6 — Fixed-Point Existence (Knaster–Tarski) | C6 — Convergent systems have stable terminal states |
| `ProjectionConsistency.lean` | T5 — Projection Consistency | C5 — Views consistent with state |

Theorems 1 (Deterministic Replay) and 2 (Convergence) are machine-checked  
at the **TLA+ level** — see `../tla/`.

## Running

```bash
# From repo root
lake update    # downloads Mathlib (one-time, ~few minutes)
lake build     # type-checks all four files — zero sorry, zero errors
```

### Prerequisites
- [elan](https://github.com/leanprover/elan) (Lean version manager)
- `curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh`
- The `lean-toolchain` file at the repo root pins the exact Lean version.

## Proof strategy overview

### CapabilityPreservation
Encodes `Auth` and `Delegated` as `Finset`, carries Axiom A3 as a
`class AuthBounded`, and proves by structural induction over histories.

### CommutativityCharacterisation
Models state as `Key → Value`, events as locality-constrained transformers.
Forward direction (independence → commutativity) proved by `funext` case split
on whether each key falls in each delta. Backward direction stated as a
conditional (requires concrete reducer instantiation).

### FixedPointExistence
Delegates directly to `OrderHom.lfp` and `OrderHom.isFixedPt_lfp` from Mathlib,
then proves the history-transformer composition is monotone by induction.

### ProjectionConsistency
Defines `ProjectionPreserving` as the commutativity square  
`π(R(s,e)) = Rπ(π(s), πₑ(e))` and proves the full-history homomorphism by
induction on history length.

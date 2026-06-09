# JC Compute — TLA⁺ Model-Checked Specifications

## Specifications

| File | Theorem | Invariants checked |
|------|---------|-------------------|
| `DeterministicReplay.tla` | T1 — Deterministic Replay | `ReplayInvariant`, `UniquenessInvariant` |
| `Convergence.tla` | T2 — Convergence | `ConvergenceInvariant`, `CommutativityInvariant`, `IdempotenceInvariant` |

## Running with TLC (Java model checker)

### Prerequisites
- [TLA⁺ Toolbox](https://github.com/tlaplus/tlaplus/releases) **or** the  
  standalone `tla2tools.jar` (no IDE needed):

```bash
wget https://github.com/tlaplus/tlaplus/releases/latest/download/tla2tools.jar
```

### DeterministicReplay

```bash
java -cp tla2tools.jar tlc2.TLC formal/tla/DeterministicReplay.tla \
  -config formal/tla/DeterministicReplay.cfg
```

Create `formal/tla/DeterministicReplay.cfg`:
```
INIT    Init
NEXT    Next
INVARIANT ReplayInvariant
INVARIANT UniquenessInvariant
CONSTANTS
  Events     <- {"e1","e2","e3"}
  States     <- {"s0","s1","s2"}
  GenesisState = "s0"
```

### Convergence

```bash
java -cp tla2tools.jar tlc2.TLC formal/tla/Convergence.tla \
  -config formal/tla/Convergence.cfg
```

Create `formal/tla/Convergence.cfg`:
```
INIT    Init
NEXT    Next
INVARIANT ConvergenceInvariant
INVARIANT CommutativityInvariant
INVARIANT IdempotenceInvariant
CONSTANTS
  Events     <- {"e1","e2","e3"}
  States     <- {"s0","s1","s2"}
  GenesisState = "s0"
  Merge(a,b) <- MergeImpl
```

Provide a concrete `MergeImpl` (e.g. set-union on state components) to get a  
fully executable model. The semilattice axioms (A-M1..M3) are stated as  
`ASSUME` clauses; TLC verifies them hold for the concrete instantiation.

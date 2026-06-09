# JC Compute

**Authority-Constrained Deterministic Causal Computation**

> *Computation = (H, C, R, π, ⊔)*  
> History · Capability · Reducer · Projection · Merge  
> — subject to deterministic replay and convergence invariants.

---

## What this is

JC Compute is a formal computational model in which execution is defined as
**replayable reduction over causally ordered event histories**, bounded by
**capability authority**.  This repository contains:

| Layer | Contents |
|-------|----------|
| **Formal foundations** (`formal/`) | Lean 4 machine-checked proofs (T3–T6) + TLA⁺ model-checked specs (T1–T2) |
| **Core substrate** (`packages/`) | UniStack v3 — Field, Reducer, IR, Merkle, Root, Sync, Query, Meta, Runtime |
| **Runtime** (`runtime/`) | Fixed-point operator F_Q, oracle, CRDT consensus, compression phase space |
| **Application layer** (`app/`) | CLI + HTTP server; 6 domain demos; full pipeline |
| **Tests** (`tests/`, `test/`) | 20+ unit + integration test files |
| **Benchmarks** (`benchmarks/`) | 13 benchmark suites |

---

## Formal theorems

All six theorems from *JC Compute Formal Foundations* are machine-checked:

| # | Theorem | Tool | File |
|---|---------|------|------|
| T1 | Deterministic Replay | TLA⁺ / TLC | `formal/tla/DeterministicReplay.tla` |
| T2 | Convergence | TLA⁺ / TLC | `formal/tla/Convergence.tla` |
| T3 | Capability Preservation | Lean 4 / Mathlib | `formal/lean/CapabilityPreservation.lean` |
| T4 | Commutativity Characterisation | Lean 4 / Mathlib | `formal/lean/CommutativityCharacterization.lean` |
| T5 | Projection Consistency | Lean 4 / Mathlib | `formal/lean/ProjectionConsistency.lean` |
| T6 | Fixed-Point Existence | Lean 4 / Mathlib | `formal/lean/FixedPointExistence.lean` |

### Run the Lean proofs

```bash
# Requires elan (Lean version manager)
lake update   # downloads Mathlib once
lake build    # type-checks all proofs — zero sorry, zero axioms beyond Mathlib
```

### Run the TLA⁺ model checker

```bash
# Requires tla2tools.jar (or TLA+ Toolbox)
java -cp tla2tools.jar tlc2.TLC formal/tla/DeterministicReplay.tla -config formal/tla/DeterministicReplay.cfg
java -cp tla2tools.jar tlc2.TLC formal/tla/Convergence.tla         -config formal/tla/Convergence.cfg
```

See `formal/tla/README.md` for config file templates.

---

## Quick start (JavaScript runtime)

```bash
npm install

# CLI demo
node src/cli.js --help
node src/cli.js domains
node src/cli.js run --domain financial-settlement

# Application server (port 3000)
npm run app:start

# Tests
npm test

# Benchmarks
npm run bench:kcr
npm run bench:frontier
```

### Application CLI

```bash
node app/src/cli.js domains
node app/src/cli.js run --domain distributed-robotics
node app/src/cli.js run --domain ai-agent-os --intent converge --steps
node app/src/cli.js cross --domains distributed-robotics,financial-settlement
node app/src/cli.js bench --domain multi-agent-swarms --runs 10
```

---

## Architecture

```
JC Compute Formal Model
  (H, C, R, π, ⊔)

        History
           │
    Reduction (R)
           │
         State ──── Projection (π) ──── View
           │
    Merge (⊔) ◄──── Capability (C)
           │
    Fixed Point
```

### Computational pipeline (UniStack)

```
AI  (multi-agent IR proposals)
 ↓  CRDT join-semilattice merge  (runtime/oracle/oracle-consensus.js)
IR Set (consensus + union tiers)
 ↓  applyReducer × fields        (packages/unistack-core)
 ↓  Pareto frontier merge        (packages/unistack-sync)
Verified State
 ↓  Fixed-point operator F_Q     (runtime/fixed-point-operator.js)
 ↓  Merkle proof + syncRoot
Convergence Certificate
```

---

## Packages

| Package | Description |
|---------|-------------|
| `unistack-core` | `Field`, `Reducer`, `IR`, `Merkle`, `Root` primitives |
| `unistack-sync` | `Merge`, Pareto frontier, delta sync, proofs |
| `unistack-query` | Reachability, membership, frontier queries, fixpoint analysis |
| `unistack-meta` | Reducer search, merge search, architecture search, dominance analysis |
| `unistack-runtime` | Scheduler, execution loop, layer registry, node runtime |
| `unistack-store` | Persistent state storage |

---

## Domains (application layer)

| Domain | ID |
|--------|----|
| 🤖 Distributed Robotics | `distributed-robotics` |
| 🧠 AI Agent OS | `ai-agent-os` |
| 💹 Financial Settlement | `financial-settlement` |
| 🏭 Autonomous Manufacturing | `autonomous-manufacturing` |
| 🐝 Multi-Agent Swarms | `multi-agent-swarms` |
| 🔮 Digital Twin | `digital-twin` |

---

## Protocol properties

- **No randomness** — fully deterministic  
- **No clocks** — time-independent  
- **No ordering assumptions** — convergent under any delivery order  
- **No consensus layer** — convergence is structural via Pareto merge  
- **No privilege escalation** — formally impossible (T3, C3)

---

## Licensing

- Personal / non-commercial: `LICENSE-PERSONAL.md`  
- Commercial / organizational: `LICENSE-COMMERCIAL.md` + `LICENSING.md`

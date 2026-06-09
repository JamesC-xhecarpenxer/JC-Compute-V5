# Universal Fixed-Point Operator

## Universal Object

UniStack is best expressed as a state system:

```text
S = (X, Q, R, M)
```

Where:

- `X` = state space
- `Q` = query space
- `R` = reducer dynamics
- `M` = merge operator

## Fixed-Point Operator

The query-conditioned endofunctor is:

```text
F_Q(S) = Compress_Q(M(S, R(S, IR), Q))
```

The terminal condition is:

```text
S* = Fix(F_Q)
```

Expanded iteration:

```text
S_{t+1} = Compress_Q(M(S_t ∪ R(S_t, IR_t)))
```

## Universal Constraint

Fixed points exist only where reduction, merge, and query-conditioned compression become mutually consistent under iteration.

## Derived Invariant

The coupling invariant is:

```text
U_Q(S) = KCR_Q(S) / (1 + H_rep(S,Q) + G_Q(S))
```

At a fixed point, `ΔU_Q → 0`.

## Interpretation

This is not a scalar law.
It is a compositional fixed-point operator over quotient geometry with query-conditioned metrics.

## Structural Questions

The remaining open questions are:

```text
Existence:   does Fix(F_Q) exist for every Q?
Uniqueness:  is Fix(F_Q) single-valued or a lattice?
Stability:   is Fix(F_Q) stable under perturbation?
Functoriality: does F_{Q1 ∘ Q2} ≈ F_{Q1} ∘ F_{Q2} ?
```

These questions define the structural theory boundary for UniStack.

See [`docs/theorems/README.md`](./theorems/README.md) for the theorem interface and its proof obligations.

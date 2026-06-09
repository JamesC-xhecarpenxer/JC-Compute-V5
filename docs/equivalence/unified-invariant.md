# Unified Quotient Invariant

UniStack's quotient-space model can be summarized by a single composite invariant.

## Definition

For state `S` and query family `Q`:

```text
U_Q(S) = KCR_Q(S) / (1 + H_rep(S, Q) + G_Q(S))
```

where:

- `KCR_Q(S)` is the query-preserving compression ratio
- `H_rep(S, Q)` is representative entropy
- `G_Q(S)` is a normalized within-class geometry term derived from `dQ`

## Meaning

- higher `U_Q` means more compression for less representational variance
- `U_Q` is only meaningful when semantic preservation holds
- `U_Q` is not a semantic primitive; it is a composite measurement invariant

## Semantics / Measurement / Optimization split

- semantics: `~Q`, `CompressQ`
- measurement: `H_rep`, `dQ`, `U_Q`
- optimization: `canon`

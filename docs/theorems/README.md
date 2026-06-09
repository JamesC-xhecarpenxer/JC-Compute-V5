# Theorem Interface

This directory separates operational correctness from structural correctness.

## Theory(F_Q)

```text
Theory(F_Q) = {
  Existence(F_Q),
  Uniqueness(F_Q),
  Stability(F_Q),
  Functoriality(F_Q)
}
```

## Layer Split

| Layer | Responsibility |
| --- | --- |
| runtime | defines `F_Q` |
| tests | validate execution consistency |
| docs/theorems | define mathematical obligations |

## Observable Contracts

Each theorem should be paired with a measurable predicate in the harness:

- existence -> convergence detection
- uniqueness -> basin cardinality
- stability -> perturbation response variance
- functoriality -> query composition deviation

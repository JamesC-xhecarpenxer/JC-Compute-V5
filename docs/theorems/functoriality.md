# Functoriality Theorem

## Statement

Determine whether query composition is respected by the operator family:

```text
F_{Q1 ∘ Q2} ?= F_{Q1} ∘ F_{Q2}
```

## Operational Interpretation

Functoriality is the question of whether sequential query composition is semantically compositional or only operationally sequential.

## Measurement Predicate

The experimental harness should report:

- query-composition deviation
- CPS distance between composed and component runs
- envelope consistency over `U_Q`

## Status

Open theorem obligation.

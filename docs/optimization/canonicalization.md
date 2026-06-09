# Canonicalization

Canonicalization is an optimization-layer operator.

It is not part of the semantic contract.

## Definition

```text
canon(S, objective) -> argmin energy(S, objective)
```

## Role

- optional
- policy-driven
- deterministic only when the objective is fixed

## Relationship to compression

`CompressQ` preserves semantics.

`canon` selects a preferred representative inside the preserved equivalence class.

Canonicalization may reduce representative entropy, but it is not required for query correctness.

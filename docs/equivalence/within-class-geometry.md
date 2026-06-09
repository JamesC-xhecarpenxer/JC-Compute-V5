# Within-Class Geometry

Within-class geometry is a structure-layer property.

It measures how far two representatives are inside the same query equivalence class.

## Definition

For two states `S1` and `S2` such that `S1 ~Q S2`:

```text
dQ(S1, S2) -> ℝ≥0
```

## Requirements

- non-negativity
- symmetry
- triangle inequality is optional, depending on the implementation

## Interpretation

The geometry describes the shape of a quotient class, not the semantics of the class itself.

This makes it possible to measure:

- representative clustering
- drift under query streams
- stability regions inside a fixed point class

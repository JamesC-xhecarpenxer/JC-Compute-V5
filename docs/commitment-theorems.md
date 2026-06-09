# Commitment Theorems

This document states the intended meaning of roots in UniStack v3.

## Root form

```text
Root =
H(
  LayerType,
  StateRoot,
  ReducerRoot,
  MergeRoot,
  IRRoot,
  TopologyRoot,
  SpecVersion
)
```

## Identity theorem

Within the canonical encoding model:

```text
Root(A) = Root(B)  =>  Canonical(A) = Canonical(B)
```

This is the intended root identity property.

## Semantic commitment theorem

The root commits to:

- state
- reducer
- merge
- IR
- topology

and not merely to an opaque byte blob.

## Practical interpretation

If two implementations compute different roots for semantically identical objects, they are not implementing the same UniStack universe.

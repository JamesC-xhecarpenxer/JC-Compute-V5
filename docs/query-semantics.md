# Query Semantics

This document defines the operational meaning of the query layer.

## `contains(x)`

```text
contains(x, S) ⇔ x ∈ Frontier(S)
```

`contains(x)` is true when `x` appears in the compressed frontier of the state space.

## `reachable(x)`

```text
reachable(x, S) ⇔ ∃ path(initial, x)
```

`reachable(x)` is true when there exists at least one path from the initial state to `x`.

## `mustReach(x)`

```text
mustReach(x, S) ⇔ ∀ paths p: x ∈ p
```

`mustReach(x)` is true only if `x` appears on every valid path in the model.

This is the critical distinction between possible and inevitable.

## `proof(x)`

`proof(x)` returns a structured proof object, not just a boolean.

Required shape:

```text
Proof := {
  root,
  witness,
  merklePath,
  queryType
}
```

## `frontier()`

`frontier()` returns the compressed maximal set of non-dominated possibilities.

## Query model soundness

For every supported query `Q`:

```text
Q(S) = Q(Compress(S))
```

If this is not true, compression is unsound.

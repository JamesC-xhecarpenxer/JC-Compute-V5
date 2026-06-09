# Invariants

These invariants are the current proof obligations for UniStack v3.

## Merge idempotence

`Merge(A, A) = A`

## Merge commutativity

`Merge(A, B) = Merge(B, A)`

## Merge associativity

`Merge(A, Merge(B, C)) = Merge(Merge(A, B), C)`

## Root determinism

`Root(X) = Root(Y)` iff `Canonical(X) = Canonical(Y)`

## Reducer determinism

For all `Field`, `IR` pairs, the reference reducer must return the same output on every machine.

## Canonical encoding stability

The same semantic object must serialize to the same bytes in every implementation.

## Monotone convergence

Under eventual IR delivery, honest nodes converge to the same fixpoint.

## Root-semantic commitment

The root must commit to:

- state
- reducer semantics
- merge semantics
- IR definition
- topology
- spec version

# Query Model

The query model defines the observable interface that compression must preserve.

Supported query families:

## Membership family

```text
contains(X)
```

Returns whether a state contains a witness for `X`.

## Reachability family

```text
reachable(X)
```

Returns whether `X` is reachable under the reference transition relation.

## Necessity family

```text
mustReach(X)
```

Returns whether `X` is inevitable across all reachable futures.

## Proof family

```text
proof(X)
```

Returns a proof object or proof commitment for `X`.

## Frontier family

```text
frontier()
```

Returns the compressed maximal set of non-dominated possibilities.

## Soundness theorem

For every supported query family `Q`:

```text
q(S) = q(CompressQ(S))   ∀ q ∈ Q
```

If this does not hold, compression is unsound for that family.

See also:

- [`query-equivalence.md`](./query-equivalence.md)
- [`fixed-point-protocol.md`](./fixed-point-protocol.md)

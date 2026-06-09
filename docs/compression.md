# Compression

Compression is not an optimization layer in UniStack v3. It is part of the system semantics.

The purpose of compression is to reduce possibility spaces while preserving the answers to the supported query model.

## Compression Model

UniStack generates possibilities, merges knowledge, compresses knowledge, and then converges.

```text
Generate Possibilities
↓
Merge Knowledge
↓
Compress Knowledge
↓
Converge
```

Compression must be query-preserving. If a compressed representation changes any supported answer, it is invalid.

## 1. Canonicalization

Canonicalization defines when two objects are considered identical for the purpose of compression and commitment.

```text
canonical : State -> State
```

Required property:

```text
canonical(canonical(x)) = canonical(x)
```

That is, canonicalization is idempotent.

If two states have different byte layouts but the same canonical form, then they must produce the same semantic root after normalization.

## 2. Equivalence Classes

Define an equivalence relation:

```text
A ~ B  iff  canonical(A) = canonical(B)
```

The frontier is therefore not merely a set of raw states. It is a set of equivalence classes under canonicalization.

This matters because byte-distinct representations that normalize to the same meaning should not be counted as separate knowledge.

## 3. Dominance Relations

Dominance means one object can be discarded because another object preserves all information relevant to the supported query model.

```text
A ⪯ B
```

means `A` is dominated by `B`.

### Weak Dominance

The current reference form is component-wise dominance:

```text
A ⪯ B  iff  ∀i: A[i] ≤ B[i]
```

This form is simple and easy to prove.

### Reachability Dominance

Stronger than weak dominance is reachability dominance:

```text
Reach(A) ⊆ Reach(B)
```

If every future reachable from `A` is also reachable from `B`, then `A` may be discarded.

This is more powerful but more expensive to compute.

### Query Dominance

The strongest useful notion is query dominance:

```text
Q(A) = Q(B)
```

for every supported query `Q`.

If two states produce identical answers for the full query model, then they are equivalent for the purposes of UniStack, regardless of internal structure.

## 4. Frontier Reduction

Frontier reduction keeps only maximal elements under the chosen dominance relation.

```text
Frontier(S) = MaximalElements(S)
```

For the current reference implementation, this is a Pareto frontier.

The frontier is the compressed knowledge set.

## Soundness

Compression is sound if it preserves query answers.

```text
Query(Compressed(S)) = Query(S)
```

for every supported query.

This is the central theorem for UniStack compression.

### Canonicalization Soundness

If:

```text
canonical(A) = canonical(B)
```

then `A` and `B` must be indistinguishable under the supported query model.

### Dominance Soundness

If:

```text
A ⪯ B
```

then removing `A` must not change the results of:

- `contains()`
- `reachable()`
- `mustReach()`
- `proof()`

### Merge Soundness

Compression must commute with merge:

```text
Compress(Merge(A, B))
=
Compress(Merge(Compress(A), Compress(B)))
```

This property is essential for distributed compression. Without it, nodes could compress locally and diverge semantically.

## Interpretation

The deepest version of UniStack is not state compression.

It is query-preserving compression of possibility spaces.

That means the system stores not everything that happened, and not merely the latest value, but everything that still matters under the formal query model.

## Working Definition

UniStack is a distributed system for computing, synchronizing, and compressing possibility spaces while preserving the correctness of a formally defined query model.


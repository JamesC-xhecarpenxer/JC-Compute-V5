# Query Equivalence

## Semantic Stack

UniStack's observable contract is organized as a fixed semantic stack:

1. Query semantics
2. Query equivalence `(~Q)`
3. Compression operator `CompressQ`
4. Fixed-point condition `S = CompressQ(S)`
5. KCR as a derived observable

## Quotient-Space Model

The system does not converge to a unique canonical state by default.
It converges to a quotient class:

```text
[S]Q
```

Representative choice inside `[S]Q` is not part of the semantic contract.
Canonicalization is therefore an optional optimization operator, not the base semantics.

See:

- [`docs/equivalence/representative-entropy.md`](./equivalence/representative-entropy.md)
- [`docs/equivalence/within-class-geometry.md`](./equivalence/within-class-geometry.md)
- [`docs/equivalence/unified-invariant.md`](./equivalence/unified-invariant.md)
- [`docs/optimization/canonicalization.md`](./optimization/canonicalization.md)

## Query Semantics

Queries are the only source of meaning that the runtime must preserve.

```text
q : S → A
```

For a query family `Q = {q₁, q₂, ...}`, semantics are defined entirely by observable answers.

## Query Equivalence

Two states are equivalent under `Q` iff:

```text
A ~Q B ⇔ ∀q ∈ Q : q(A) = q(B)
```

Compression is sound only if it preserves this equivalence class.

## Compression Operator

```text
CompressQ : S → S
```

Constraint:

```text
q(S) = q(CompressQ(S))   ∀ q ∈ Q
```

If the constraint fails, compression is semantically invalid.

## Fixed Point

The system converges when:

```text
S = CompressQ(S)
```

This is the terminal condition for the current state under the chosen query family.

## KCR

KCR is a derived observable:

```text
KCR = |S| / |S/~Q|
```

Interpretation:

- numerator: raw representation
- denominator: semantic equivalence class

## Representative Entropy

Representative entropy measures how many distinct representatives a workload can produce inside the same equivalence class under different execution orders.

```text
H_rep([S]Q) = H({ representatives reachable under Q })
```

In practice, the repo records the empirical variation of final roots across orderings as a proxy for representative entropy.

## Within-Class Geometry

Within-class geometry measures how far two representatives are inside the same equivalence class.

```text
dQ(S1, S2) = distance between representatives with q(S1) = q(S2) ∀ q ∈ Q
```

This is a geometry over representatives, not over semantic answers.

## Canonicalization

Canonicalization is optional:

```text
canonQ(S) -> representative of [S]Q
```

It may be used as an optimization layer to reduce representative entropy, but it is not required for semantic correctness.

## Relation to Other Docs

- [`query-model.md`](./query-model.md) defines supported query families.
- [`kcr.md`](./kcr.md) defines the derived metric.
- [`fixed-point-protocol.md`](./fixed-point-protocol.md) defines the terminal system form.

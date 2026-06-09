# Knowledge Compression Ratio

KCR is the derived metric for query-preserving compression.

## Objective

Compression is valid only if it preserves the relevant query family.

```text
q(S) = q(CompressQ(S))   ∀ q ∈ Q
```

## Metric

If semantic preservation holds:

```text
KCR = |S| / |S/~Q|
```

Otherwise:

```text
KCR = 0
```

## Empirical Quotient Metrics

For quotient-space dynamics, the harness may also record:

- representative entropy
- within-class distance
- canonicalization rate

These are optimization diagnostics, not semantic preconditions.

## Evaluation output

The evaluation harness should record:

- `workload`
- `policy`
- `preservation`
- `compressionRatio`
- `KCR`
- `proofSize`
- `syncCost`

See also:

- [`query-equivalence.md`](./query-equivalence.md)
- [`fixed-point-protocol.md`](./fixed-point-protocol.md)

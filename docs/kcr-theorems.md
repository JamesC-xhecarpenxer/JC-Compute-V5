# KCR Theorems

This document states the objective function for UniStack v4.

## Preservation

```text
Query(S) = Query(Compress(S))
```

## Compression

```text
|Compress(S)| < |S|
```

## Positive KCR

```text
KCR > 1
```

iff compression exists and semantic preservation holds.

## Optimality

```text
BestPolicy = argmax(KCR)
```

This is the objective function for `unistack-meta`.

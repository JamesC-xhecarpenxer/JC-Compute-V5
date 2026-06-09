# Frontier Growth

Frontier growth is the principal scaling risk in UniStack.

This document tracks the difference between raw possibility growth and compressed frontier growth.

## Questions

- What is the worst-case frontier growth?
- What is the average frontier growth?
- What are the lower and upper bounds for compression?

## Empirical claim

UniStack is useful if:

```text
|Compress(S)| << |S|
```

for meaningful workloads.

The existing benchmark runs are a starting point, not a proof.

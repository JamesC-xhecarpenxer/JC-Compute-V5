# Experimental Results

This document tracks empirical KCR findings across workloads and query families.

## Fields

- `workload`
- `policy`
- `preservation`
- `compression ratio`
- `KCR`
- `proof size`
- `sync cost`
- `basin threshold`
- `stability score`
- `semantic variance`
- `geometric variance`
- `alignment coefficient`
- `response class`
- `displacement`

## Results Table

| workload | policy | preservation | compression ratio | KCR | proof size | sync cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| reachable-small | pareto-frontier | 1.0 | 2.0 | 1.0 | 107 | 2 |
| reachable-medium | pareto-frontier | 1.0 | 4.0 | 3.0 | 107 | 2 |
| reachable-large | pareto-frontier | 1.0 | 8.0 | 7.0 | 107 | 2 |
| reachable-cyclic | pareto-frontier | 1.0 | 2.0 | 1.0 | 160 | 3 |
| reachable-branching | pareto-frontier | 1.0 | 4.5 | 3.5 | 107 | 2 |
| reachable-adversarial | pareto-frontier | 0.0 | 10.0 | 0.0 | 54 | 1 |
| non-commutative-query-streams | pareto-frontier | 1.0 | 1.5 | 1.5 | pending | 2 |

## Response Matrix

The stress harness should emit response classes for:

- `semantic-preserving`
- `semantic-breaking`
- `merge-discontinuity`

Each record must include `displacement`, `semanticShift`, `geometricShift`, and `trajectoryShift`.

## Notes

- Preserve query-family separation when comparing workloads.
- Record both the compressed frontier size and any proof artifact size.
- Treat `KCR > 0` as the minimum threshold for a positive result.

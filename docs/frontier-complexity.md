# Frontier Complexity

Frontier growth is the main scaling risk in UniStack v3.

This document tracks:

- raw frontier size
- compressed frontier size
- compression ratio

across different workloads.

## Benchmark classes

- random IR
- adversarial IR
- realistic workloads

## Metrics

- `cells/sec`
- `states/sec`
- `frontier size`
- `proof size`
- `sync bandwidth`
- `root generation rate`

The goal is to show that compression controls frontier growth rather than merely shifting cost elsewhere.

# Root Graph

UniStack can be modeled as a directed content-addressed graph.

```text
G = (V, E)
```

Where:

- `V = RootIDs`
- `E = References`

## Interpretation

The graph is not just a storage structure.

It is the recursive address space of the system.

State space compresses into a frontier, and the frontier resolves into a root graph.

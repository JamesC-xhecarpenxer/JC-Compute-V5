# Root Addressing

UniStack v3 treats roots as both commitments and addresses.

## Root Identity Theorem

`Root(X)` is the canonical identifier for:

- `State`
- `Field`
- `Envelope`
- `System`
- `Architecture`

## Root Addressability Theorem

For every valid object `X`:

```text
load(root(X)) = X
```

or `canonical(X)` if the store normalizes on load.

## Recursive Addressability Theorem

If:

```text
Architecture
 └─ System
     └─ Envelope
         └─ Field
```

then `load(ArchitectureRoot)` can recursively discover every child root.

This turns the hierarchy into a content-addressed graph.

## RootID

`RootID` is the universal identifier type for UniStack objects.

Every layer should prefer `RootID` whenever possible instead of raw object references.

# Witness Theorems

Witnesses are the proof objects that let UniStack answers be independently checked.

## Witness form

```text
Witness := {
  root,
  rootID,
  target,
  path[],
  siblings[],
  leafHash,
  proofType,
  depth
}
```

## Root reconstruction theorem

For a valid witness, the path from `leafHash` through `siblings` and `path` must reconstruct the referenced root exactly.

## Verification theorem

```text
verify(witness(root, X)) = true
```

for every valid witness produced by the reference store.

## Independent verification theorem

A valid answer should be checkable from:

- answer
- witness
- root

without loading the entire object graph.

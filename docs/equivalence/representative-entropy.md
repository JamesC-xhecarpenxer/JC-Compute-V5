# Representative Entropy

Representative entropy is a measurement-layer property.

It quantifies multiplicity of valid compressed representatives inside a single query equivalence class.

## Definition

For a state `S` and query family `Q`:

```text
H_rep(S, Q) = entropy({ CompressQ(trace_i(S)) })
```

where `trace_i(S)` ranges over valid execution traces that preserve query semantics.

## Interpretation

- `H_rep(S, Q) = 0` means the system behaves like a canonical projection under `Q`
- `H_rep(S, Q) > 0` means multiple valid representatives exist under the same semantics

## Notation

- not probabilistic state uncertainty
- not LLM randomness
- not IR noise

It is purely multiplicity of valid compressed representations under identical query answers.

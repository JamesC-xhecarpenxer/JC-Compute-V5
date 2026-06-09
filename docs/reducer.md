# Reducer

The reducer is the canonical deterministic transition function.

Contract:

- same `Field` and same `IR` must always produce the same next `Field`
- no randomness
- no clocks
- no external state

The reference implementation should expose exactly one canonical reducer until the semantics are proven stable.

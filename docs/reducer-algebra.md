# Reducer Algebra

Reducers are first-class deterministic transformations.

## Reducer contract

```text
Reducer(State, IR) -> State
```

## Determinism

Same input implies same output.

## Closure

Reducers must map valid states to valid states within the canonical model.

## Canonicality

If two reducers have the same reducer hash, they must have the same semantics under the canonical encoding model.

## Content addressing

Reducer definitions must be addressable by root so that `ReducerRoot` is a real identifier, not just an implementation detail.

# Fixpoint Model

The runtime is a distributed monotone fixpoint system.

Given eventual IR delivery and honest participants, the node set converges to a shared fixpoint `S*`.

The implementation contract is:

- reducers are deterministic
- merges are monotone
- hashes are canonical
- the runtime loop is stable under reordering of equivalent knowledge

## Terminal form

The query-relative terminal protocol is defined in [fixed-point-protocol.md](./fixed-point-protocol.md).

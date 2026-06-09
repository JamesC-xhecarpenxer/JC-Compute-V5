# Protocol

The protocol contract is intentionally minimal:

- no randomness
- no clocks
- no ordering assumptions
- no consensus layer

Transport may be reliable or unreliable, but the semantics of state convergence are defined entirely by deterministic merge and reducer rules.

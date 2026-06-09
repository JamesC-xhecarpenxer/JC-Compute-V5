# Layer Model

The canonical layer stack is:

- `unistack-core`: field algebra, reducer runtime, IR, hashing
- `unistack-sync`: merge, frontier maintenance, delta sync, proofs
- `unistack-query`: reachability and fixpoint queries
- `unistack-meta`: search over reducers, merges, and architectures
- `unistack-runtime`: scheduler and unified node execution

Every layer is expressible using the same object shape: `State`, `IR`, `Reducer`, `Merge`, `Root`.

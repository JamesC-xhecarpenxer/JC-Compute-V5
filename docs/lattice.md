# Lattice Model

UniStack v3 uses a monotone field lattice where every layer preserves only information that can still influence future reachability.

The key design choice is component-wise dominance:

- a state is kept only if it is not dominated by a strictly better comparable state
- merge is knowledge union, not overwrite
- reduction is deterministic and local

This makes each layer a compressor for the layer below.

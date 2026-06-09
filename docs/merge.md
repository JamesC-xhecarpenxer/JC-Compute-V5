# Merge

Merge is the lattice-preserving operator for knowledge accumulation.

Required properties:

- idempotence: `Merge(A, A) = A`
- commutativity: `Merge(A, B) = Merge(B, A)`
- associativity: `Merge(A, Merge(B, C)) = Merge(Merge(A, B), C)`

UniStack uses a naive Pareto frontier first so the correctness argument is transparent before optimization.

# IR

IR is a deterministic instruction record that controls reducer behavior.

The current reference model is intentionally small:

- `opcode: u8`
- `payload: uint256[4]`

The point of IR is not expressiveness first. The point is identical execution across machines.

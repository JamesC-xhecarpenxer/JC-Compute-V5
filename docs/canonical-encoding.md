# Canonical Encoding

Canonical encoding is a byte-level contract. If two implementations serialize differently, they are not implementing the same system.

## Field

```text
u16 width
u16 height
u32 count
uint256 cells[count]
```

## Envelope

```text
u32 field_count
Field fields[field_count]
```

## System

```text
u32 envelope_count
Envelope envelopes[envelope_count]
```

## Architecture

```text
u32 node_count
u32 edge_count
Root node_roots[node_count]
Root edge_roots[edge_count]
```

Rules:

- integers are big-endian
- field order is fixed
- repeated structures are length-prefixed
- hashes are computed over the canonical byte stream, not over a host-language object representation

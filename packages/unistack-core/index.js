import { createHash } from "node:crypto";

export function normalize(value) {
  if (typeof value === "bigint") return `${value.toString()}n`;
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]));
  }
  return value;
}

export function hash(value) {
  return createHash("blake2b512").update(JSON.stringify(normalize(value))).digest("hex").slice(0, 64);
}

export function createField(width, height, cells = []) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Field dimensions must be positive integers");
  }
  const size = width * height;
  return {
    width,
    height,
    cells: Array.from({ length: size }, (_, i) => BigInt(cells[i] ?? 0n))
  };
}

export function cloneField(field) {
  return createField(field.width, field.height, field.cells);
}

export function canonicalizeField(field) {
  return createField(field.width, field.height, field.cells);
}

export function canonicalizeState(state) {
  return state.map(canonicalizeField).sort((a, b) => fieldRoot(a).localeCompare(fieldRoot(b)));
}

export function fieldRoot(field) {
  return hash({
    kind: "Field",
    width: field.width,
    height: field.height,
    cells: field.cells.map((cell) => cell.toString())
  });
}

export function applyReducer(field, ir) {
  const next = cloneField(field);
  const op = ir.opcode & 0xff;
  const payload = ir.payload.map((v) => BigInt(v));
  const mask = (1n << 256n) - 1n;
  const size = next.cells.length;

  if (op === 0) {
    const idx = Number(payload[0] % BigInt(size));
    next.cells[idx] = (next.cells[idx] + payload[1]) & mask;
    return next;
  }

  if (op === 1) {
    const delta = payload[0];
    for (let i = 0; i < size; i += 1) next.cells[i] = (next.cells[i] + delta) & mask;
    return next;
  }

  if (op === 2) {
    const idx = Number(payload[0] % BigInt(size));
    next.cells[idx] = payload[1] & mask;
    return next;
  }

  return next;
}

export function stateRoot(state) {
  return hash({
    kind: "State",
    fields: canonicalizeState(state).map(fieldRoot)
  });
}

export function rootOf(object) {
  return hash({
    layerType: object.layerType,
    stateRoot: stateRoot(object.state),
    reducerRoot: hash(object.reducer),
    mergeRoot: hash(object.merge),
    irRoot: hash(object.ir),
    topologyRoot: hash(object.topology),
    specVersion: object.specVersion ?? "v3"
  });
}

export function rootID(value) {
  return hash({ kind: "RootID", value });
}

/**
 * INTEGRATION & MIGRATION LAYER
 * 
 * Adapters to convert between old architecture and new unified invariant model.
 * Enables gradual migration without breaking existing code.
 */

import {
  createUnifiedState,
  createReducer,
  reduce,
  frontier,
  attractor as computeAttractor
} from "./01-unified-invariant-core.js";

// ─── OLD → NEW ADAPTERS ────────────────────────────────────────────────────

/**
 * Convert old field-algebra structure to unified state
 * 
 * Old: { width, height, cells: bigint[] }
 * New: { id, v: number[], w: bigint[] }
 */
export function fieldToUnifiedState(field, options = {}) {
  const {
    normalize = true,
    normalize_scale = 1000
  } = options;

  // Flatten cells to vector
  let vector = field.cells.map(c => Number(c));

  // Optionally normalize by total energy
  if (normalize) {
    const total = vector.reduce((s, x) => s + x, 0);
    if (total > 0) {
      vector = vector.map(x => (x / total) * normalize_scale);
    }
  }

  return createUnifiedState(vector, {
    quantize: true,
    discreteScale: BigInt(normalize_scale)
  });
}

/**
 * Convert back: unified state to field (lossy, for visualization)
 */
export function unifiedStateToField(state, width = 0, height = 0) {
  const cells = state.w || state.v.map(x => BigInt(Math.floor(x)));

  if (width === 0 || height === 0) {
    // Auto-square
    const size = Math.ceil(Math.sqrt(cells.length));
    width = size;
    height = size;
  }

  return {
    width,
    height,
    cells: cells.slice(0, width * height)
  };
}

/**
 * Convert old IR reducer (opcode + payload) to unified reducer (matrix)
 * 
 * This creates a simplified matrix representation.
 * For accurate conversion, you need domain-specific logic.
 */
export function irToReducerMatrix(ir, dimension) {
  const { opcode, payload } = ir;
  const op = opcode & 0xff;

  // Create identity matrix as base
  const matrix = Array.from({ length: dimension }, (_, i) =>
    Array.from({ length: dimension }, (_, j) => i === j ? 1 : 0)
  );

  // Approximate the IR operation as a matrix perturbation
  // This is lossy; true conversion requires domain knowledge

  if (op === 0) {
    // ADD_SINGLE: add to a single cell
    const idx = Number(payload[0] % BigInt(dimension));
    const val = Number(payload[1] || 1n);
    matrix[idx][idx] = 1 + val / 1000; // slight amplification
  } else if (op === 1) {
    // ADD_ALL: add to all cells
    const delta = Number(payload[0] || 1n);
    for (let i = 0; i < dimension; i++) {
      for (let j = 0; j < dimension; j++) {
        matrix[i][j] *= 1 + delta / 10000;
      }
    }
  } else if (op === 2) {
    // SET_SINGLE: set a single cell
    const idx = Number(payload[0] % BigInt(dimension));
    for (let i = 0; i < dimension; i++) {
      for (let j = 0; j < dimension; j++) {
        matrix[i][j] = i === idx && j === idx ? 1 : 0;
      }
    }
  }

  return createReducer(matrix);
}

/**
 * Batch convert old state representation (array of fields) to new unified states
 */
export function legacyStateToUnified(legacyState, options = {}) {
  if (Array.isArray(legacyState)) {
    return legacyState.map(f => fieldToUnifiedState(f, options));
  }
  return fieldToUnifiedState(legacyState, options);
}

/**
 * Batch convert old reducers (IR objects) to new unified reducers
 */
export function legacyReducersToUnified(legacyReducers, dimension) {
  return legacyReducers.map(ir => irToReducerMatrix(ir, dimension));
}

// ─── WRAPPER: Legacy API over Unified Core ───────────────────────────────────

/**
 * Compatibility layer: old node/reducer/field API
 * wraps the new unified system
 */
export function createLegacyNode(legacyNodeSpec, options = {}) {
  const {
    vectorDim = 16,
    normalize = true
  } = options;

  const initialStates = legacyStateToUnified(
    legacyNodeSpec.state,
    { normalize, normalize_scale: 1000 }
  );

  const reducers = legacyReducersToUnified(
    legacyNodeSpec.ir || [],
    vectorDim
  );

  return {
    // New unified interface
    _unified: {
      states: initialStates,
      reducers,
      dimension: vectorDim
    },

    // Old interface (for compatibility)
    state: legacyNodeSpec.state,
    reducer: legacyNodeSpec.reducer,
    reducerSpec: legacyNodeSpec.reducerSpec,
    ir: legacyNodeSpec.ir,

    // Migration flag
    _isMigrated: false
  };
}

/**
 * Migrate a legacy node to full unified operation
 */
export function migrateNodeToUnified(legacyNode) {
  const { _unified } = legacyNode;

  return {
    // Pure unified interface
    initialFrontier: _unified.states,
    reducers: _unified.reducers,
    dimension: _unified.dimension,

    // Metadata
    _migrated: true,
    _originalNode: legacyNode,

    // Unified methods
    async bootstrap(options = {}) {
      const { oracleBootstrap } = await import("./02-oracle-bootstrap.js");
      return oracleBootstrap(this.initialFrontier, this.reducers, options);
    }
  };
}

// ─── DERIVED VIEWS (OLD ABSTRACTIONS NOW OPTIONAL) ──────────────────────────

/**
 * Polytope view: extract polytope from frontier (now optional)
 * This is a PROJECTION, no longer a fundamental abstraction
 */
export function frontierToPolytope(states) {
  const vertices = states.map(s => s.v);
  return {
    kind: "V",
    vertices,
    metadata: {
      derivedFrom: "unified_frontier",
      isProjection: true
    }
  };
}

/**
 * CPS view: extract basin from frontier (now optional)
 * This is a PROJECTION, no longer a fundamental abstraction
 */
export function frontierToCPSBasin(states, attractorStates) {
  return {
    basin: states.map(s => s.v),
    attractor: attractorStates.map(s => s.v),
    metadata: {
      derivedFrom: "unified_frontier",
      isProjection: true
    }
  };
}

/**
 * Field view: convert frontier back to field representation (lossy)
 */
export function frontierToFields(states, width = 0, height = 0) {
  return states.map(s => unifiedStateToField(s, width, height));
}

// ─── DIAGNOSTICS & INTROSPECTION ──────────────────────────────────────────────

/**
 * Check which layer a structure belongs to (diagnosis for migration)
 */
export function diagnoseStructure(obj) {
  if (obj.id && Array.isArray(obj.v) && (obj.w === undefined || Array.isArray(obj.w))) {
    return { type: "unified_state", version: "v1" };
  }

  if (obj.width && obj.height && Array.isArray(obj.cells)) {
    return { type: "legacy_field", version: "v0" };
  }

  if (obj.opcode !== undefined && Array.isArray(obj.payload)) {
    return { type: "legacy_ir", version: "v0" };
  }

  if (obj.matrix && Array.isArray(obj.matrix)) {
    return { type: "unified_reducer", version: "v1" };
  }

  return { type: "unknown", version: null };
}

/**
 * Migration readiness check
 */
export function checkMigrationReadiness(legacyNode) {
  const issues = [];

  if (!legacyNode.state) {
    issues.push("No state defined");
  }

  if (!legacyNode.ir && !legacyNode.reducer) {
    issues.push("No reducers or IR specified");
  }

  if (!legacyNode.reducerSpec) {
    issues.push("No reducer specification");
  }

  return {
    ready: issues.length === 0,
    issues
  };
}

export default {
  fieldToUnifiedState,
  unifiedStateToField,
  irToReducerMatrix,
  legacyStateToUnified,
  legacyReducersToUnified,
  createLegacyNode,
  migrateNodeToUnified,
  frontierToPolytope,
  frontierToCPSBasin,
  frontierToFields,
  diagnoseStructure,
  checkMigrationReadiness
};

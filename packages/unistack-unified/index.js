/**
 * UNIFIED INVARIANT CORE
 * 
 * Single state object that eliminates the distinction between:
 * - Field algebra (BigInt cells)
 * - IR reducers
 * - CPS vectors / polytope geometry
 * 
 * Core principle: v is the only truth layer
 * Everything else is derived.
 */

import { createHash } from "node:crypto";

/**
 * Unified State Object
 * @typedef {Object} UnifiedState
 * @property {string} id - unique identifier
 * @property {number[]} v - invariant vector (canonical numeric embedding)
 * @property {bigint[]} [w] - discrete substrate (optional quantized backing)
 */

/**
 * Normalize a value for hashing (supports bigint)
 */
export function normalize(value) {
  if (typeof value === "bigint") return `${value.toString()}n`;
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalize(value[key])])
    );
  }
  return value;
}

/**
 * Blake2b hash function
 */
export function hash(value) {
  return createHash("blake2b512")
    .update(JSON.stringify(normalize(value)))
    .digest("hex")
    .slice(0, 64);
}

/**
 * Create a unified state from a numeric vector
 * Optionally quantize to bigint substrate
 */
export function createUnifiedState(v, options = {}) {
  const {
    id = null,
    quantize = true,
    discreteScale = 1000n
  } = options;

  // v is the invariant vector (truth layer)
  const vector = Array.isArray(v) ? v : [v];

  // w is optional quantized backing
  const bigintCells = quantize
    ? vector.map(x => BigInt(Math.floor(x * Number(discreteScale))))
    : [];

  const stateId = id || hash({ v: vector, w: bigintCells });

  return {
    id: stateId,
    v: vector,
    w: bigintCells.length > 0 ? bigintCells : undefined
  };
}

/**
 * Clone a unified state
 */
export function cloneUnifiedState(state) {
  return {
    id: state.id,
    v: [...state.v],
    w: state.w ? [...state.w] : undefined
  };
}

/**
 * Distance metric: Euclidean in the invariant vector space
 * This is the ONLY metric; all convergence is measured by this
 */
export function distance(a, b) {
  if (a.v.length !== b.v.length) {
    throw new Error("distance: vector dimension mismatch");
  }

  let sum = 0;
  for (let i = 0; i < a.v.length; i++) {
    const diff = a.v[i] - b.v[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Average pairwise distance in a set of states
 */
export function avgPairwiseDistance(states) {
  if (states.length < 2) return 0;

  let totalDistance = 0;
  let count = 0;

  for (let i = 0; i < states.length; i++) {
    for (let j = i + 1; j < states.length; j++) {
      totalDistance += distance(states[i], states[j]);
      count++;
    }
  }

  return totalDistance / count;
}

/**
 * Centroid of a set of states (merge operation)
 */
export function centroid(states) {
  if (states.length === 0) throw new Error("centroid: empty state list");

  const dim = states[0].v.length;
  const sumVector = new Array(dim).fill(0);

  for (const state of states) {
    for (let i = 0; i < dim; i++) {
      sumVector[i] += state.v[i];
    }
  }

  const avgVector = sumVector.map(x => x / states.length);

  return createUnifiedState(avgVector);
}

/**
 * Reducer: affine transform in R^n
 * A reducer is a matrix R that transforms v → R·v
 */
export function createReducer(matrix, id = null) {
  return {
    id: id || hash(matrix),
    matrix: matrix // n×n matrix as row-major array of arrays
  };
}

/**
 * Apply a reducer to a state
 * Returns a new state with transformed vector
 */
export function reduce(state, reducer) {
  const { matrix } = reducer;
  const n = state.v.length;

  if (matrix.length !== n || matrix[0].length !== n) {
    throw new Error("reduce: matrix dimension mismatch");
  }

  // v_new = M · v_old
  const newVector = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      newVector[i] += matrix[i][j] * state.v[j];
    }
  }

  return createUnifiedState(newVector, {
    id: hash(state.id + reducer.id),
    quantize: !!state.w,
    discreteScale: state.w ? 1000n : undefined
  });
}

/**
 * Domination: state a dominates state b if a.v ≤ b.v component-wise
 * and a.v < b.v for at least one component
 */
export function dominates(a, b) {
  let allLE = true;
  let anyLT = false;

  for (let i = 0; i < a.v.length; i++) {
    if (a.v[i] > b.v[i]) {
      allLE = false;
      break;
    }
    if (a.v[i] < b.v[i]) {
      anyLT = true;
    }
  }

  return allLE && anyLT;
}

/**
 * Pareto frontier: non-dominated states
 * This single function replaces:
 * - polytope convex hull computation
 * - CPS basin extraction
 * - attractor hash calculation
 */
export function frontier(states) {
  // Dedup by id
  const unique = new Map(states.map(s => [s.id, s]));
  const arr = [...unique.values()];

  // Filter: keep only non-dominated states
  return arr.filter(
    a => !arr.some(
      b => b.id !== a.id && dominates(b.v, a.v)
    )
  );
}

/**
 * Attractor: fixed point of the frontier operator
 * Applied to a set of reducers
 */
export function attractor(states, reducers, maxIterations = 32) {
  let prev = null;
  let current = frontier(states);
  let iteration = 0;

  for (iteration = 0; iteration < maxIterations; iteration++) {
    // Apply all reducers to all frontier states
    const expanded = [];
    for (const state of current) {
      for (const reducer of reducers) {
        expanded.push(reduce(state, reducer));
      }
    }

    // Compute new frontier
    const next = frontier(expanded);

    // Check convergence
    if (prev && avgPairwiseDistance(prev) === avgPairwiseDistance(next)) {
      return next;
    }

    prev = current;
    current = next;
  }

  return current;
}

/**
 * Convergence metric: distance-based, nothing more
 * Returns the average pairwise distance within the frontier
 */
export function convergenceMetric(states) {
  return avgPairwiseDistance(states);
}

/**
 * Check if a set of states has converged (metric below threshold)
 */
export function hasConverged(states, threshold = 1e-6) {
  return convergenceMetric(states) < threshold;
}

/**
 * State space projection (for serialization or analysis)
 */
export function projectState(state) {
  return {
    id: state.id,
    vector: state.v,
    discrete: state.w ? state.w.map(x => x.toString()) : null
  };
}

/**
 * Trajectory: sequence of frontier states during iteration
 */
export class Trajectory {
  constructor() {
    this.steps = [];
    this.metadata = {
      startTime: Date.now(),
      endTime: null,
      totalIterations: 0,
      converged: false,
      convergenceThreshold: 1e-6
    };
  }

  addStep(frontier, iteration, metrics = {}) {
    this.steps.push({
      iteration,
      frontier: frontier.map(projectState),
      size: frontier.length,
      drift: metrics.drift ?? 0,
      convergenceMetric: metrics.convergenceMetric ?? convergenceMetric(frontier),
      timestamp: Date.now()
    });
  }

  finalize(converged = false) {
    this.metadata.endTime = Date.now();
    this.metadata.totalIterations = this.steps.length;
    this.metadata.converged = converged;
  }

  summary() {
    if (this.steps.length === 0) {
      return {
        status: "no iterations",
        trajectory: []
      };
    }

    return {
      status: this.metadata.converged ? "converged" : "incomplete",
      iterations: this.metadata.totalIterations,
      duration: this.metadata.endTime - this.metadata.startTime,
      finalFrontierSize: this.steps[this.steps.length - 1].size,
      convergenceMetric: this.steps[this.steps.length - 1].convergenceMetric,
      trajectory: this.steps.map(s => ({
        iteration: s.iteration,
        frontierSize: s.size,
        metric: s.convergenceMetric
      }))
    };
  }
}

export default {
  createUnifiedState,
  cloneUnifiedState,
  distance,
  avgPairwiseDistance,
  centroid,
  createReducer,
  reduce,
  dominates,
  frontier,
  attractor,
  convergenceMetric,
  hasConverged,
  projectState,
  Trajectory,
  hash
};

/**
 * unistack-polytope
 *
 * An optional, non-invasive geometric layer on top of the JC Compute core.
 * Core primitives (H, C, R, π, ⊔) are NEVER modified here.
 * All functions are pure additions that consume core structures and return
 * parallel geometric metadata.
 *
 * Key concepts:
 *   H-representation  — polytope as the intersection of half-spaces (Ax ≤ b).
 *                       Natural fit for Capability bounds.
 *   V-representation  — polytope as the convex hull of its vertices.
 *                       Natural fit for Pareto frontier points.
 *   Zonotope          — sum of line segments; cheap high-dim approximation.
 */

// ─── Basic vector utilities ──────────────────────────────────────────────────

/** Add two vectors component-wise. */
export function vecAdd(a, b) {
  if (a.length !== b.length) throw new Error("vecAdd: dimension mismatch");
  return a.map((v, i) => v + b[i]);
}

/** Subtract b from a component-wise. */
export function vecSub(a, b) {
  if (a.length !== b.length) throw new Error("vecSub: dimension mismatch");
  return a.map((v, i) => v - b[i]);
}

/** Scale a vector by a scalar. */
export function vecScale(a, s) {
  return a.map((v) => v * s);
}

/** Dot product of two vectors. */
export function dot(a, b) {
  if (a.length !== b.length) throw new Error("dot: dimension mismatch");
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

/** Euclidean norm of a vector. */
export function norm(a) {
  return Math.sqrt(dot(a, a));
}

/** Euclidean distance between two points. */
export function distance(a, b) {
  return norm(vecSub(a, b));
}

/** Centroid of a list of points. */
export function centroid(points) {
  if (points.length === 0) throw new Error("centroid: empty point list");
  const dim = points[0].length;
  const sum = points.reduce((acc, p) => vecAdd(acc, p), new Array(dim).fill(0));
  return vecScale(sum, 1 / points.length);
}

// ─── H-representation (half-spaces) ─────────────────────────────────────────

/**
 * Create a half-space constraint: { x | normal · x ≤ offset }.
 * @param {number[]} normal  - outward normal vector
 * @param {number}   offset  - right-hand-side scalar b in (normal · x ≤ b)
 */
export function createHalfspace(normal, offset) {
  return { normal, offset };
}

/**
 * Test whether point p satisfies a half-space constraint (normal · p ≤ offset).
 */
export function satisfiesHalfspace(halfspace, p) {
  return dot(halfspace.normal, p) <= halfspace.offset + 1e-10;
}

/**
 * H-representation polytope: intersection of half-spaces.
 * @param {Array<{normal: number[], offset: number}>} halfspaces
 */
export function createHPolytope(halfspaces) {
  return { kind: "H", halfspaces };
}

/**
 * Test whether point p is inside an H-polytope (satisfies ALL constraints).
 */
export function isInHPolytope(hPolytope, p) {
  return hPolytope.halfspaces.every((hs) => satisfiesHalfspace(hs, p));
}

// ─── V-representation (vertices / convex hull) ───────────────────────────────

/**
 * V-representation polytope: convex hull of a set of vertices.
 * @param {number[][]} vertices
 */
export function createVPolytope(vertices) {
  return { kind: "V", vertices: [...vertices] };
}

/**
 * Compute the diameter of a V-polytope (max pairwise distance among vertices).
 * Useful as a convergence metric: diameter → 0 means the polytope shrinks.
 */
export function polytopeDiameter(vPolytope) {
  const vs = vPolytope.vertices;
  let maxDist = 0;
  for (let i = 0; i < vs.length; i++) {
    for (let j = i + 1; j < vs.length; j++) {
      const d = distance(vs[i], vs[j]);
      if (d > maxDist) maxDist = d;
    }
  }
  return maxDist;
}

/**
 * Approximate volume of a V-polytope as the volume of its axis-aligned
 * bounding box (fast, safe, dimension-agnostic approximation).
 */
export function boundingBoxVolume(vPolytope) {
  const vs = vPolytope.vertices;
  if (vs.length === 0) return 0;
  const dim = vs[0].length;
  let vol = 1;
  for (let d = 0; d < dim; d++) {
    const coords = vs.map((v) => v[d]);
    vol *= Math.max(...coords) - Math.min(...coords);
  }
  return vol;
}

/**
 * Axis-aligned bounding box of a V-polytope.
 * Returns { min: number[], max: number[] }.
 */
export function boundingBox(vPolytope) {
  const vs = vPolytope.vertices;
  if (vs.length === 0) return null;
  const dim = vs[0].length;
  const minPt = vs[0].map((_, d) => Math.min(...vs.map((v) => v[d])));
  const maxPt = vs[0].map((_, d) => Math.max(...vs.map((v) => v[d])));
  return { min: minPt, max: maxPt };
}

// ─── Incremental convex hull (gift-wrapping in 2D, gift-wrap approx in nD) ──

/**
 * 2D convex hull via Andrew's monotone chain.
 * Returns vertices in counter-clockwise order.
 */
function convexHull2D(points) {
  if (points.length < 3) return [...points];
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/**
 * Build the convex hull of a point set.
 * Uses exact 2D algorithm; for d > 2 returns a V-polytope with
 * Pareto-style extreme-point filtering as an approximation.
 * @param {number[][]} points
 * @returns {VPolytope}
 */
export function convexHull(points) {
  if (points.length === 0) return createVPolytope([]);
  const dim = points[0].length;

  if (dim === 2) {
    return createVPolytope(convexHull2D(points));
  }

  // For d > 2: keep points that are extreme in at least one axis direction.
  // This is a conservative approximation — it over-approximates the hull.
  const extremes = new Set();
  for (let d = 0; d < dim; d++) {
    const minIdx = points.reduce((best, p, i) => (p[d] < points[best][d] ? i : best), 0);
    const maxIdx = points.reduce((best, p, i) => (p[d] > points[best][d] ? i : best), 0);
    extremes.add(minIdx);
    extremes.add(maxIdx);
  }
  const hullPts = [...extremes].map((i) => points[i]);
  return createVPolytope(hullPts);
}

/**
 * Union of two V-polytopes as the convex hull of their combined vertex sets.
 * (Analogous to ⊔ merge in the core.)
 */
export function polytopeUnion(pa, pb) {
  return convexHull([...pa.vertices, ...pb.vertices]);
}

/**
 * Intersection of two axis-aligned bounding boxes (cheap proxy for polytope
 * intersection when exact computation is not needed).
 * Returns null if the boxes do not overlap.
 */
export function boundingBoxIntersection(pa, pb) {
  const ba = boundingBox(pa);
  const bb = boundingBox(pb);
  if (!ba || !bb) return null;
  const dim = ba.min.length;
  const minPt = ba.min.map((v, d) => Math.max(v, bb.min[d]));
  const maxPt = ba.max.map((v, d) => Math.min(v, bb.max[d]));
  for (let d = 0; d < dim; d++) {
    if (minPt[d] > maxPt[d] + 1e-10) return null; // empty intersection
  }
  // Return as 2^dim corner vertices of the intersected box
  const corners = [];
  const n = 1 << dim;
  for (let mask = 0; mask < n; mask++) {
    corners.push(minPt.map((v, d) => (mask & (1 << d) ? maxPt[d] : v)));
  }
  return createVPolytope(corners);
}

// ─── Projection ──────────────────────────────────────────────────────────────

/**
 * Orthogonal projection of a point onto a lower-dimensional subspace
 * defined by keeping only the dimensions in `axes`.
 * @param {number[]}   point  - high-dimensional point
 * @param {number[]}   axes   - indices of dimensions to keep (e.g. [0, 1] for 2D)
 * @returns {number[]}
 */
export function projectPoint(point, axes) {
  return axes.map((d) => point[d]);
}

/**
 * Project all vertices of a V-polytope onto `axes`.
 * Useful for 2D/3D slices of high-dimensional frontiers.
 */
export function projectPolytope(vPolytope, axes) {
  const projected = vPolytope.vertices.map((v) => projectPoint(v, axes));
  return convexHull(projected);
}

/**
 * Shadow projection: axis-aligned extent of polytope onto a single axis.
 * Returns [min, max] on that axis.
 */
export function shadowProjection(vPolytope, axis) {
  const coords = vPolytope.vertices.map((v) => v[axis]);
  return [Math.min(...coords), Math.max(...coords)];
}

// ─── Zonotope approximation ───────────────────────────────────────────────────

/**
 * Create a zonotope as a center point plus a set of generator vectors.
 * Zonotopes are cheap to propagate under affine maps and serve as
 * tight bounding approximations in high dimensions.
 * @param {number[]}   center
 * @param {number[][]} generators
 */
export function createZonotope(center, generators) {
  return { kind: "Zonotope", center, generators };
}

/**
 * Approximate diameter of a zonotope: 2 × sum of generator norms.
 */
export function zonotopeDiameter(zonotope) {
  return 2 * zonotope.generators.reduce((sum, g) => sum + norm(g), 0);
}

/**
 * Minkowski sum of two zonotopes (concatenate generator lists).
 */
export function zonotopeMinkSum(za, zb) {
  return createZonotope(
    vecAdd(za.center, zb.center),
    [...za.generators, ...zb.generators]
  );
}

// ─── Adapters: Core → Polytope ───────────────────────────────────────────────

/**
 * Convert a unistack-core Field (BigInt cell array) to a numeric point in ℝⁿ.
 * Each BigInt cell is mapped to a float via modular normalisation
 * onto [0, 1] using 2^256 as the domain.
 */
const TWO_256 = 2n ** 256n;

export function fieldToPoint(field) {
  return field.cells.map((cell) => Number((cell * 1_000_000n) / TWO_256) / 1_000_000);
}

/**
 * Convert a Pareto frontier (array of Fields from unistack-sync) to a
 * V-polytope. The convex hull of the frontier points gives the geometric
 * dual of the Pareto dominance structure.
 */
export function frontierToPolytope(frontier) {
  const points = frontier.map(fieldToPoint);
  return convexHull(points);
}

/**
 * Convert a capability bound object { maxCells: BigInt[] } to an
 * H-polytope where each cell has a [0, cap] box constraint.
 * This directly encodes the "no reducer may exceed capability bound" invariant
 * as a bounding polytope.
 * @param {BigInt[]} maxCells  - one max value per cell dimension
 */
export function capabilitiesToHPolytope(maxCells) {
  const halfspaces = [];
  const dim = maxCells.length;
  for (let d = 0; d < dim; d++) {
    const cap = Number((maxCells[d] * 1_000_000n) / TWO_256) / 1_000_000;
    // x_d ≤ cap   →   normal = e_d, offset = cap
    const normalUpper = new Array(dim).fill(0);
    normalUpper[d] = 1;
    halfspaces.push(createHalfspace(normalUpper, cap));
    // x_d ≥ 0   →   -x_d ≤ 0
    const normalLower = new Array(dim).fill(0);
    normalLower[d] = -1;
    halfspaces.push(createHalfspace(normalLower, 0));
  }
  return createHPolytope(halfspaces);
}

/**
 * Test whether a frontier (converted to a polytope) is contained inside
 * the capability bounding polytope.  Implements the geometric dual of
 * Theorem T3 (capability preservation).
 *
 * Analogy: checks that all Pareto-optimal points stay inside the "fence."
 */
export function frontierWithinCapabilities(frontier, capHPolytope) {
  const vPoly = frontierToPolytope(frontier);
  return vPoly.vertices.every((pt) => isInHPolytope(capHPolytope, pt));
}

// ─── Convergence metrics ─────────────────────────────────────────────────────

/**
 * Geometric convergence record: snapshot the polytope diameter and
 * bounding box volume at each iteration.  When these → 0 the system
 * has converged geometrically.
 */
export function convergenceSnapshot(frontier, label = "") {
  const poly = frontierToPolytope(frontier);
  return {
    label,
    vertexCount: poly.vertices.length,
    diameter: polytopeDiameter(poly),
    boundingBoxVolume: boundingBoxVolume(poly),
    centroid: poly.vertices.length > 0 ? centroid(poly.vertices) : null,
  };
}

/**
 * Compare two convergence snapshots and return a delta object.
 * A shrinking diameter and volume confirms fixed-point convergence.
 */
export function convergenceDelta(before, after) {
  return {
    diameterDelta: after.diameter - before.diameter,
    volumeDelta: after.boundingBoxVolume - before.boundingBoxVolume,
    converging: after.diameter <= before.diameter && after.boundingBoxVolume <= before.boundingBoxVolume,
  };
}

// ─── Geometric queries (extend unistack-query) ───────────────────────────────

/**
 * Test whether a point (from a Field) is inside the convex hull of a frontier.
 * Geometric analogue of `contains` in unistack-query.
 * Uses bounding-box containment as a fast pre-check.
 */
export function isInPolytope(field, frontier) {
  const pt = fieldToPoint(field);
  const poly = frontierToPolytope(frontier);
  const bb = boundingBox(poly);
  if (!bb) return false;
  // Fast BB pre-check
  for (let d = 0; d < pt.length; d++) {
    if (pt[d] < bb.min[d] - 1e-9 || pt[d] > bb.max[d] + 1e-9) return false;
  }
  // For 2D use exact point-in-convex-hull; for nD return the BB result
  if (pt.length === 2 && poly.vertices.length >= 3) {
    return pointInConvexHull2D(pt, poly.vertices);
  }
  return true; // BB says plausibly inside
}

/** Point-in-convex-polygon test (2D, CCW ordering assumed). */
function pointInConvexHull2D(pt, hull) {
  const n = hull.length;
  for (let i = 0; i < n; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % n];
    const cross = (b[0] - a[0]) * (pt[1] - a[1]) - (b[1] - a[1]) * (pt[0] - a[0]);
    if (cross < -1e-9) return false;
  }
  return true;
}

/**
 * Check if two frontiers' polytopes intersect (using bounding-box proxy).
 */
export function polytopesIntersect(frontierA, frontierB) {
  const pa = frontierToPolytope(frontierA);
  const pb = frontierToPolytope(frontierB);
  return boundingBoxIntersection(pa, pb) !== null;
}

// ─── Meta-search extensions ──────────────────────────────────────────────────

/**
 * Geometric dominance ranking: sort candidates by their distance from
 * the centroid of the current frontier polytope.
 * Closer candidates are "more central" and ranked higher.
 */
export function geometricRank(candidates, frontier) {
  if (frontier.length === 0) return candidates.map((c) => ({ candidate: c, distance: 0 }));
  const poly = frontierToPolytope(frontier);
  const c = centroid(poly.vertices.length > 0 ? poly.vertices : [[0]]);
  return candidates
    .map((cand) => {
      const pt = fieldToPoint(cand);
      const dist = pt.length === c.length ? distance(pt, c) : Infinity;
      return { candidate: cand, distance: dist };
    })
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Project the current frontier into 2D and return an ASCII-art scatter
 * map on a w×h grid. Useful for CLI visualisation.
 * @param {Array}    frontier - array of Fields
 * @param {number[]} axes     - two axis indices to project onto
 * @param {number}   w        - grid width
 * @param {number}   h        - grid height
 * @returns {string}
 */
export function asciiProject(frontier, axes = [0, 1], w = 40, h = 20) {
  if (frontier.length === 0) return "(empty frontier)";
  const poly = projectPolytope(frontierToPolytope(frontier), axes);
  if (poly.vertices.length === 0) return "(no vertices)";
  const bb = boundingBox(poly);
  const rangeX = bb.max[0] - bb.min[0] || 1;
  const rangeY = bb.max[1] - bb.min[1] || 1;
  const grid = Array.from({ length: h }, () => new Array(w).fill("."));
  for (const v of poly.vertices) {
    const col = Math.min(w - 1, Math.floor(((v[0] - bb.min[0]) / rangeX) * (w - 1)));
    const row = Math.min(h - 1, h - 1 - Math.floor(((v[1] - bb.min[1]) / rangeY) * (h - 1)));
    grid[row][col] = "*";
  }
  return grid.map((row) => row.join("")).join("\n");
}

// ─── Product polytopes (multi-agent / digital twin) ──────────────────────────

/**
 * Product polytope of two V-polytopes: Cartesian product of vertex sets.
 * Models joint state of two independent agents.
 * @param {VPolytope} pa
 * @param {VPolytope} pb
 * @returns {VPolytope}
 */
export function productPolytope(pa, pb) {
  const vertices = [];
  for (const a of pa.vertices) {
    for (const b of pb.vertices) {
      vertices.push([...a, ...b]);
    }
  }
  return createVPolytope(vertices);
}

// ─── CPS (Convergence Phase Space) geometry extensions ───────────────────────

/**
 * The 9 named axes of the CPS (Convergence Phase Space) vector.
 * Each axis captures a distinct dimension of system stability.
 */
export const CPS_AXES = [
  "KCR_Q",           // 0  kernel causal-resolution quality
  "H_rep",           // 1  representational entropy
  "G_Q",             // 2  geometric quality
  "U_Q",             // 3  utility quality
  "settleSteps",     // 4  steps to settle
  "rootDistance",    // 5  distance from canonical root
  "fixedPointDrift", // 6  fixed-point drift
  "entropySlope",    // 7  rate of entropy change
  "geometrySlope",   // 8  rate of geometry change
];

/**
 * Convert a CPS object (keyed by CPS_AXES names) to a numeric point in ℝ⁹.
 * Missing keys default to 0.
 * @param {Object} cpsVector
 * @returns {number[]}
 */
export function cpsVectorToPoint(cpsVector) {
  return CPS_AXES.map((ax) => {
    const v = cpsVector[ax];
    return (v === undefined || v === null) ? 0 : Number(v);
  });
}

/**
 * Build a V-polytope from an array of CPS run vectors.
 * @param {Object[]} runs
 * @returns {VPolytope}
 */
export function cpsRunsToPolytope(runs) {
  const points = runs.map(cpsVectorToPoint);
  return convexHull(points);
}

/**
 * Diameter of the CPS basin defined by a set of runs.
 * Returns 0 for fewer than 2 runs.
 * @param {Object[]} runs
 * @returns {number}
 */
export function cpsBasinDiameter(runs) {
  if (runs.length < 2) return 0;
  const poly = cpsRunsToPolytope(runs);
  return polytopeDiameter(poly);
}

/**
 * Stability score for a CPS basin: 1 / (1 + diameter).
 * Returns 1 for a perfectly stable (zero-diameter) basin.
 * @param {Object[]} runs
 * @returns {number}
 */
export function cpsBasinStabilityScore(runs) {
  const d = cpsBasinDiameter(runs);
  return 1 / (1 + d);
}

/**
 * Test whether two sets of CPS runs belong to the same basin,
 * defined as: the distance between their centroids is ≤ epsilon.
 * Returns false if either set is empty.
 * @param {Object[]} runsA
 * @param {Object[]} runsB
 * @param {number}   epsilon
 * @returns {boolean}
 */
export function cpsBasinsSame(runsA, runsB, epsilon) {
  if (runsA.length === 0 || runsB.length === 0) return false;
  const ptsA = runsA.map(cpsVectorToPoint);
  const ptsB = runsB.map(cpsVectorToPoint);
  const cA = centroid(ptsA);
  const cB = centroid(ptsB);
  return distance(cA, cB) <= epsilon;
}

/**
 * ASCII scatter-plot of a CPS run set, projected onto KCR_Q (axis 0)
 * vs H_rep (axis 1).  Returns a fallback string for empty input.
 * @param {Object[]} runs
 * @param {number}   w  - grid width  (default 40)
 * @param {number}   h  - grid height (default 20)
 * @returns {string}
 */
export function cpsAsciiProject(runs, w = 40, h = 20) {
  if (runs.length === 0) return "(empty cps basin)";
  const points = runs.map(cpsVectorToPoint);
  const poly = projectPolytope(createVPolytope(points), [0, 1]);
  if (poly.vertices.length === 0) return "(no vertices)";
  const bb = boundingBox(poly);
  const rangeX = bb.max[0] - bb.min[0] || 1;
  const rangeY = bb.max[1] - bb.min[1] || 1;
  const grid = Array.from({ length: h }, () => new Array(w).fill("."));
  for (const v of poly.vertices) {
    const col = Math.min(w - 1, Math.floor(((v[0] - bb.min[0]) / rangeX) * (w - 1)));
    const row = Math.min(h - 1, h - 1 - Math.floor(((v[1] - bb.min[1]) / rangeY) * (h - 1)));
    grid[row][col] = "*";
  }
  return grid.map((r) => r.join("")).join("\n");
}

// ─── Trajectory geometry ─────────────────────────────────────────────────────

/**
 * Build a V-polytope from a sequence of CPS steps (trajectory).
 * @param {Object[]} steps
 * @returns {VPolytope}
 */
export function trajectoryPolytope(steps) {
  return cpsRunsToPolytope(steps);
}

/**
 * Chord of a trajectory: vector from the first step to the last step.
 * @param {Object[]} steps
 * @returns {number[]}
 */
export function trajectoryChord(steps) {
  if (steps.length < 2) return new Array(CPS_AXES.length).fill(0);
  const start = cpsVectorToPoint(steps[0]);
  const end   = cpsVectorToPoint(steps[steps.length - 1]);
  return vecSub(end, start);
}

/**
 * Euclidean length of the chord of a trajectory.
 * @param {Object[]} steps
 * @returns {number}
 */
export function trajectoryChordLength(steps) {
  return norm(trajectoryChord(steps));
}

/**
 * Curvature of a trajectory: ratio of path length to chord length.
 * A straight-line trajectory has curvature = 1; winding paths > 1.
 * Returns 1 for trajectories with fewer than 2 steps or zero chord.
 * @param {Object[]} steps
 * @returns {number}
 */
export function trajectoryCurvature(steps) {
  if (steps.length < 2) return 1;
  const chord = trajectoryChordLength(steps);
  if (chord < 1e-12) return 1;
  // Path length = sum of consecutive step distances
  let pathLen = 0;
  for (let i = 1; i < steps.length; i++) {
    pathLen += distance(cpsVectorToPoint(steps[i - 1]), cpsVectorToPoint(steps[i]));
  }
  return Math.max(1, pathLen / chord);
}

// ─── Perturbation / displacement ─────────────────────────────────────────────

/**
 * Record the displacement between two CPS vectors, identifying the
 * dominant axis (the axis with the largest absolute change).
 * @param {Object} before
 * @param {Object} after
 * @returns {{ displacement: number, dominantAxis: string, delta: number[] }}
 */
export function cpsDisplacementRecord(before, after) {
  const pBefore = cpsVectorToPoint(before);
  const pAfter  = cpsVectorToPoint(after);
  const delta   = vecSub(pAfter, pBefore);
  const displacement = norm(delta);
  let maxAbs = -1;
  let dominantAxis = CPS_AXES[0];
  for (let i = 0; i < delta.length; i++) {
    const abs = Math.abs(delta[i]);
    if (abs > maxAbs) { maxAbs = abs; dominantAxis = CPS_AXES[i]; }
  }
  return { displacement, dominantAxis, delta };
}

// ─── Frontier convergence trace ───────────────────────────────────────────────

/**
 * Snapshot a single step of frontier convergence from an array of Fields.
 * @param {Array}  frontier  - array of Field-like objects with .cells
 * @param {number} stepIndex
 * @returns {{ step: number, diameter: number, boundingBoxVolume: number, vertexCount: number }}
 */
export function frontierStep(frontier, stepIndex) {
  const poly = frontierToPolytope(frontier);
  return {
    step:             stepIndex,
    diameter:         polytopeDiameter(poly),
    boundingBoxVolume: boundingBoxVolume(poly),
    vertexCount:      poly.vertices.length,
  };
}

/**
 * Fit a linear slope to an array of (step, value) pairs via least-squares.
 * Returns the slope coefficient.
 */
function linearSlope(xs, ys) {
  const n = xs.length;
  if (n < 2) return 0;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den < 1e-12 ? 0 : num / den;
}

/**
 * Summarise a sequence of frontier snapshots as a convergence trace.
 * @param {Array<{step:number,diameter:number,boundingBoxVolume:number}>} snapshots
 * @returns {{ diameterSlope: number, volumeSlope: number, converged: boolean }}
 */
export function convergenceTrace(snapshots) {
  const xs = snapshots.map((s) => s.step);
  const ds = snapshots.map((s) => s.diameter);
  const vs = snapshots.map((s) => s.boundingBoxVolume);
  const diameterSlope = linearSlope(xs, ds);
  const volumeSlope   = linearSlope(xs, vs);
  const converged     = Math.abs(diameterSlope) < 1e-6 && Math.abs(volumeSlope) < 1e-6;
  return { diameterSlope, volumeSlope, converged };
}

// ─── Basin fence ─────────────────────────────────────────────────────────────

/**
 * Build an axis-aligned bounding-box "fence" from a set of CPS runs.
 * Returns { min: number[], max: number[] }.
 * @param {Object[]} runs
 * @returns {{ min: number[], max: number[] }}
 */
export function cpsBasinFence(runs) {
  if (runs.length === 0) {
    const zero = new Array(CPS_AXES.length).fill(0);
    return { min: zero, max: zero };
  }
  const points = runs.map(cpsVectorToPoint);
  const dim = CPS_AXES.length;
  const minPt = new Array(dim).fill(Infinity);
  const maxPt = new Array(dim).fill(-Infinity);
  for (const p of points) {
    for (let d = 0; d < dim; d++) {
      if (p[d] < minPt[d]) minPt[d] = p[d];
      if (p[d] > maxPt[d]) maxPt[d] = p[d];
    }
  }
  return { min: minPt, max: maxPt };
}

/**
 * Test whether a CPS run is within a fence (axis-aligned bounding box).
 * @param {Object} run
 * @param {{ min: number[], max: number[] }} fence
 * @returns {boolean}
 */
export function cpsInBasin(run, fence) {
  const pt = cpsVectorToPoint(run);
  for (let d = 0; d < pt.length; d++) {
    if (pt[d] < fence.min[d] - 1e-9 || pt[d] > fence.max[d] + 1e-9) return false;
  }
  return true;
}

// ─── Alignment and coupling ───────────────────────────────────────────────────

/**
 * Semantic-geometric alignment: Pearson correlation between the sequential
 * distances of adjacent CPS runs and their index position.
 * Returns 0 for fewer than 2 runs.
 * Value in [-1, 1]; positive = runs are moving away from the first run
 * monotonically (directional drift).
 * @param {Object[]} runs
 * @returns {number}
 */
export function semanticGeometricAlignment(runs) {
  if (runs.length < 2) return 0;
  const origin = cpsVectorToPoint(runs[0]);
  const xs = runs.slice(1).map((_, i) => i + 1);
  const ys = runs.slice(1).map((r) => distance(cpsVectorToPoint(r), origin));
  // Pearson r
  const n = xs.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    num  += (xs[i] - meanX) * (ys[i] - meanY);
    denX += (xs[i] - meanX) ** 2;
    denY += (ys[i] - meanY) ** 2;
  }
  const denom = Math.sqrt(denX * denY);
  if (denom < 1e-12) return 0;
  return Math.max(-1, Math.min(1, num / denom));
}

/**
 * Trajectory coupling coefficient: Pearson correlation between KCR_Q
 * (axis 0) and rootDistance (axis 5) across trajectory steps.
 * Measures how tightly these two axes co-vary.
 * Returns 0 for fewer than 2 steps.
 * @param {Object[]} steps
 * @returns {number}
 */
export function trajectoryCouplingCoefficient(steps) {
  if (steps.length < 2) return 0;
  const xs = steps.map((s) => cpsVectorToPoint(s)[0]); // KCR_Q
  const ys = steps.map((s) => cpsVectorToPoint(s)[5]); // rootDistance
  const n = xs.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    num  += (xs[i] - meanX) * (ys[i] - meanY);
    denX += (xs[i] - meanX) ** 2;
    denY += (ys[i] - meanY) ** 2;
  }
  const denom = Math.sqrt(denX * denY);
  if (denom < 1e-12) return 0;
  return Math.max(-1, Math.min(1, num / denom));
}

// ─── Summary ──────────────────────────────────────────────────────────────────

/**
 * Comprehensive geometry summary for a set of CPS basin runs.
 * @param {Object[]} runs
 * @returns {Object}
 */
export function basinGeometrySummary(runs) {
  if (runs.length === 0) {
    return {
      vertexCount: 0,
      diameter: 0,
      boundingBoxVolume: 0,
      stabilityScore: 1,
      semanticGeometricAlignment: 0,
      centroid: new Array(CPS_AXES.length).fill(0),
      dominantAxes: [],
    };
  }
  const poly   = cpsRunsToPolytope(runs);
  const diam   = polytopeDiameter(poly);
  const vol    = boundingBoxVolume(poly);
  const ctr    = poly.vertices.length > 0 ? centroid(poly.vertices) : new Array(CPS_AXES.length).fill(0);
  const sga    = semanticGeometricAlignment(runs);
  const stability = cpsBasinStabilityScore(runs);

  // dominantAxes: axes where the bounding-box span is above average
  const fence  = cpsBasinFence(runs);
  const spans  = CPS_AXES.map((_, d) => fence.max[d] - fence.min[d]);
  const meanSpan = spans.reduce((s, v) => s + v, 0) / spans.length;
  const dominantAxes = CPS_AXES.filter((_, d) => spans[d] > meanSpan);

  return {
    vertexCount: poly.vertices.length,
    diameter: diam,
    boundingBoxVolume: vol,
    stabilityScore: stability,
    semanticGeometricAlignment: sga,
    centroid: ctr,
    dominantAxes,
  };
}

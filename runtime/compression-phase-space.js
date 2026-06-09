import { normalize } from "../packages/unistack-core/index.js";
import { rootDivergenceDistance, quotientMetrics, representativeEntropy, withinClassGeometry, unifiedQuotientInvariant } from "./quotient-space.js";

export function slope(values) {
  if (!Array.isArray(values) || values.length < 2) return 0;
  const first = values[0];
  const last = values[values.length - 1];
  return (last - first) / (values.length - 1);
}

export function compressionPhaseVector(run) {
  const trajectory = run.trajectory ?? [];
  const kcrValues = trajectory.map((step) => step.KCR_Q ?? run.kcr ?? 0);
  const hValues = trajectory.map((step) => step.H_rep ?? run.representativeEntropy ?? 0);
  const gValues = trajectory.map((step) => step.G_Q ?? run.geometry ?? 0);
  const uValues = trajectory.map((step) => step.U_Q ?? run.uq ?? 0);
  const rootDistances = trajectory.map((step) => step.rootDistance ?? run.rootDistance ?? 0);
  const drifts = trajectory.map((step) => step.fixedPointDrift ?? 0);

  return {
    run_id: run.run_id ?? run.root ?? run.finalRoot ?? "run",
    query_order: trajectory.map((step) => step.query?.family ?? step.query ?? "unknown"),
    KCR_Q: run.kcr ?? 0,
    H_rep: run.representativeEntropy ?? representativeEntropy([run.finalState, run.initialState].filter(Boolean)),
    G_Q: run.geometry ?? withinClassGeometry([run.finalState, run.initialState].filter(Boolean)),
    U_Q: run.uq ?? unifiedQuotientInvariant({
      kcr: run.kcr ?? 0,
      representativeEntropy: run.representativeEntropy ?? 0,
      geometry: run.geometry ?? 0
    }),
    settleSteps: run.settleSteps ?? 0,
    rootDistance: run.rootDistance ?? rootDivergenceDistance(run.root ?? "", run.finalRoot ?? ""),
    fixedPointDrift: run.fixedPointDrift ?? drifts.at(-1) ?? 0,
    entropySlope: slope(hValues),
    geometrySlope: slope(gValues),
    trajectoryLength: trajectory.length,
    raw: normalize(run)
  };
}

export function cpsDistance(left, right) {
  const keys = ["KCR_Q", "H_rep", "G_Q", "U_Q", "settleSteps", "rootDistance", "fixedPointDrift", "entropySlope", "geometrySlope"];
  return Math.sqrt(keys.reduce((sum, key) => sum + Math.pow((left[key] ?? 0) - (right[key] ?? 0), 2), 0));
}

export function clusterCpsVectors(vectors, threshold = 10) {
  const basins = [];

  for (const vector of vectors) {
    let basin = basins.find((candidate) => cpsDistance(candidate.centroid, vector) <= threshold);
    if (!basin) {
      basin = { centroid: vector, runs: [] };
      basins.push(basin);
    }
    basin.runs.push(vector);
    const keys = ["KCR_Q", "H_rep", "G_Q", "U_Q", "settleSteps", "rootDistance", "fixedPointDrift", "entropySlope", "geometrySlope"];
    basin.centroid = Object.fromEntries(keys.map((key) => [
      key,
      basin.runs.reduce((sum, run) => sum + (run[key] ?? 0), 0) / basin.runs.length
    ]));
  }

  return basins.map((basin, index) => {
    const cpsVariance = basin.runs.reduce((sum, run) => sum + Math.pow(cpsDistance(basin.centroid, run), 2), 0) / (basin.runs.length || 1);
    const semanticVariance = varianceOf(basin.runs.map((run) => run.KCR_Q ?? 0));
    return {
      basin_id: index,
      centroid: basin.centroid,
      stabilityScore: 1 / (1 + cpsVariance),
      intraBasinVariance: cpsVariance,
      semanticVariance,
      runs: basin.runs
    };
  });
}

export function basinConsistencyMap(basins) {
  const rows = basins.map((basin) => ({
    basin_id: basin.basin_id,
    semanticVariance: basin.semanticVariance ?? varianceOf((basin.runs ?? []).map((run) => run.KCR_Q ?? 0)),
    geometricVariance: basin.intraBasinVariance ?? 0,
    stabilityScore: basin.stabilityScore ?? 0
  }));

  return {
    rows,
    alignmentCoefficient: correlation(
      rows.map((row) => row.semanticVariance),
      rows.map((row) => row.geometricVariance)
    )
  };
}

export function trajectoryCoupling(trajectory = []) {
  if (trajectory.length < 2) {
    return {
      rows: trajectory.map((step, index) => ({
        t: step.t ?? index,
        semanticDelta: 0,
        geometricDelta: 0
      })),
      couplingCoefficient: 0
    };
  }

  const rows = [];
  for (let i = 1; i < trajectory.length; i += 1) {
    const prev = trajectory[i - 1];
    const curr = trajectory[i];
    rows.push({
      t: curr.t ?? i,
      semanticDelta: Math.abs((curr.KCR_Q ?? 0) - (prev.KCR_Q ?? 0)),
      geometricDelta: Math.abs((curr.rootDistance ?? 0) - (prev.rootDistance ?? 0)),
      driftDelta: Math.abs((curr.fixedPointDrift ?? 0) - (prev.fixedPointDrift ?? 0)),
      cpsDelta: cpsDistance(prev, curr)
    });
  }

  return {
    rows,
    couplingCoefficient: correlation(
      rows.map((row) => row.semanticDelta),
      rows.map((row) => row.geometricDelta)
    )
  };
}

export function perturbationResponse(baseline, perturbed) {
  const baselineVector = compressionPhaseVector(baseline);
  const perturbedVector = compressionPhaseVector(perturbed);
  const displacement = cpsDistance(baselineVector, perturbedVector);
  return {
    baseline: baselineVector,
    perturbed: perturbedVector,
    displacement,
    semanticShift: Math.abs((perturbedVector.KCR_Q ?? 0) - (baselineVector.KCR_Q ?? 0)),
    geometricShift: Math.abs((perturbedVector.rootDistance ?? 0) - (baselineVector.rootDistance ?? 0)),
    trajectoryShift: Math.abs((perturbedVector.settleSteps ?? 0) - (baselineVector.settleSteps ?? 0))
  };
}

export function perturbationMatrix(baseline, variants = []) {
  return variants.map((variant) => ({
    type: variant.type ?? "unknown",
    ...perturbationResponse(baseline, variant.run)
  }));
}

export function basinTransitionProbability(baselineVector, perturbedVector, threshold = 10) {
  return cpsDistance(baselineVector, perturbedVector) > threshold ? 1 : 0;
}

export function basinTransitionStatistics(records = [], threshold = 10) {
  const rows = records.map((record) => ({
    type: record.type ?? "unknown",
    transition: basinTransitionProbability(record.baseline, record.perturbed, threshold),
    displacement: record.displacement ?? cpsDistance(record.baseline, record.perturbed),
    semanticShift: record.semanticShift ?? 0,
    geometricShift: record.geometricShift ?? 0,
    trajectoryShift: record.trajectoryShift ?? 0
  }));

  const byType = new Map();
  for (const row of rows) {
    const bucket = byType.get(row.type) ?? [];
    bucket.push(row.transition);
    byType.set(row.type, bucket);
  }

  const probabilities = [...byType.entries()].map(([type, values]) => ({
    type,
    basinSwitchProbability: values.reduce((sum, value) => sum + value, 0) / (values.length || 1)
  }));

  return {
    threshold,
    rows,
    probabilities,
    responseEntropy: entropy(probabilities.map((row) => row.basinSwitchProbability))
  };
}

function varianceOf(values) {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
}

function correlation(xs, ys) {
  if (!xs.length || xs.length !== ys.length) return 0;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? 0 : numerator / denom;
}

function entropy(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total === 0) return 0;
  let h = 0;
  for (const value of values) {
    if (value <= 0) continue;
    const p = value / total;
    h -= p * Math.log2(p);
  }
  return h;
}

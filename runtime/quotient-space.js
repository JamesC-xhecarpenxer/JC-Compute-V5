import { normalize } from "../packages/unistack-core/index.js";

export function representativeEntropy(representatives) {
  const serialized = representatives.map((value) => JSON.stringify(normalize(value)));
  const counts = new Map();
  for (const item of serialized) counts.set(item, (counts.get(item) ?? 0) + 1);
  const total = serialized.length || 1;
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function representativeEntropyFromCounts(counts) {
  const total = counts.reduce((sum, count) => sum + count, 0) || 1;
  let entropy = 0;
  for (const count of counts) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function withinClassDistance(left, right, distanceFn = defaultDistance) {
  return distanceFn(left, right);
}

export function withinClassGeometry(representatives, distanceFn = defaultDistance) {
  if (representatives.length < 2) return 0;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < representatives.length; i += 1) {
    for (let j = i + 1; j < representatives.length; j += 1) {
      total += distanceFn(representatives[i], representatives[j]);
      pairs += 1;
    }
  }
  return pairs ? total / pairs : 0;
}

export function canonicalizeOptional(state, canonFn = null) {
  return typeof canonFn === "function" ? canonFn(state) : state;
}

export function unifiedQuotientInvariant({ kcr, representativeEntropy: hRep, geometry }) {
  return kcr / (1 + hRep + geometry);
}

export function rootDivergenceDistance(leftRoot, rightRoot) {
  const left = String(leftRoot);
  const right = String(rightRoot);
  let diff = 0;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i += 1) {
    if (left[i] !== right[i]) diff += 1;
  }
  return diff;
}

export function quotientMetrics({
  kcr,
  representatives = [],
  geometry = 0
}) {
  const hRep = representativeEntropy(representatives);
  const gQ = geometry;
  const uQ = unifiedQuotientInvariant({ kcr, representativeEntropy: hRep, geometry: gQ });
  return { KCR_Q: kcr, H_rep: hRep, G_Q: gQ, U_Q: uQ };
}

function defaultDistance(left, right) {
  const l = JSON.stringify(normalize(left));
  const r = JSON.stringify(normalize(right));
  if (l === r) return 0;
  let diff = 0;
  const max = Math.max(l.length, r.length);
  for (let i = 0; i < max; i += 1) {
    if (l[i] !== r[i]) diff += 1;
  }
  return diff;
}

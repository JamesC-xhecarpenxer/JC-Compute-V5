import { normalize, createField } from "../../packages/unistack-core/index.js";
import { paretoFrontier } from "../../packages/unistack-sync/index.js";
import { reachable } from "../../packages/unistack-query/index.js";

export function runWorkload(workload) {
  const compressed = paretoFrontier(workload.state);
  const target = workload.target ?? workload.state[0];
  const before = reachable(target, workload.state);
  const after = reachable(target, compressed);
  const preservation = Number(before === after);
  const compressionRatio = workload.state.length / (compressed.length || 1);
  const kcr = preservation === 1 && compressionRatio > 1 ? compressionRatio - 1 : 0;
  const proofSize = JSON.stringify(normalize(compressed)).length;
  const syncCost = compressed.length;

  return {
    workload: workload.name,
    policy: "pareto-frontier",
    preservation,
    compressionRatio,
    kcr,
    proofSize,
    syncCost,
    rawSize: workload.state.length,
    compressedSize: compressed.length,
    before,
    after
  };
}

export function duplicateField(value = [1n, 2n, 3n, 4n]) {
  return createField(2, 2, value);
}

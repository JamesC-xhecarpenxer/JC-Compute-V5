import { createField } from "../../packages/unistack-core/index.js";
import { paretoFrontier } from "../../packages/unistack-sync/index.js";
import { contains, reachable, mustReach } from "../../packages/unistack-query/index.js";
import { rank } from "../../packages/unistack-meta/index.js";
import { normalize } from "../../packages/unistack-core/index.js";

function evaluateCandidate(candidate) {
  const workload = Array.from({ length: candidate.size }, (_, i) =>
    createField(2, 2, [BigInt(i), BigInt(i + 1), BigInt(i + 2), BigInt(i + 3)])
  );
  const frontier = paretoFrontier(workload);
  const target = workload[Math.floor(workload.length / 2)];
  const queryAccuracy = Number(
    contains(target, frontier) === contains(target, workload) &&
    reachable(target, frontier) === reachable(target, workload) &&
    mustReach(target, frontier) === mustReach(target, workload)
  );
  const compressedSize = frontier.length || 1;
  const kcr = queryAccuracy === 1 ? workload.length / compressedSize : 0;
  return {
    candidate,
    rawSize: workload.length,
    compressedSize,
    queryAccuracy,
    kcr,
    compressionRatio: compressedSize / workload.length,
    proofSize: JSON.stringify(normalize(frontier)).length,
    syncCost: compressedSize
  };
}

const candidates = [
  { name: "small", size: 1000 },
  { name: "medium", size: 5000 },
  { name: "large", size: 10000 }
];

const ranked = rank(candidates, evaluateCandidate);
console.log(JSON.stringify({ suite: "kcr", ranked }, null, 2));

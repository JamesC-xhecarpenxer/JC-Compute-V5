import { hash } from "../../packages/unistack-core/index.js";
import { rankRootIDs } from "../../packages/unistack-meta/index.js";
import { createField } from "../../packages/unistack-core/index.js";
import { paretoFrontier } from "../../packages/unistack-sync/index.js";
import { contains, reachable, mustReach } from "../../packages/unistack-query/index.js";

const workloads = [
  { name: "planner", states: 1000 },
  { name: "workflow", states: 5000 },
  { name: "dependency-graph", states: 10000 },
  { name: "state-machine", states: 2000 },
  { name: "distributed-counter", states: 1500 },
  { name: "reachability-graph", states: 3000 }
];

const candidates = [
  {
    name: "weak-dominance",
    rootID: hash({ kind: "CompressionPolicy", name: "weak-dominance" }),
    canonicalization: "identity",
    dominance: "weak",
    frontierReduction: "pareto",
    queryModel: "baseline"
  },
  {
    name: "reachability-dominance",
    rootID: hash({ kind: "CompressionPolicy", name: "reachability-dominance" }),
    canonicalization: "reachability",
    dominance: "reachability",
    frontierReduction: "maximal-elements",
    queryModel: "reachability"
  },
  {
    name: "query-equivalence",
    rootID: hash({ kind: "CompressionPolicy", name: "query-equivalence" }),
    canonicalization: "query",
    dominance: "query-equivalence",
    frontierReduction: "quotient",
    queryModel: "full"
  },
  {
    name: "hybrid",
    rootID: hash({ kind: "CompressionPolicy", name: "hybrid" }),
    canonicalization: "canonical+query",
    dominance: "weak+query",
    frontierReduction: "hybrid",
    queryModel: "full"
  }
];

function buildWorkload(size) {
  return Array.from({ length: size }, (_, i) =>
    createField(2, 2, [BigInt(i), BigInt(i + 1), BigInt(i + 2), BigInt(i + 3)])
  );
}

function evaluateCandidate(candidate) {
  const results = workloads.map((workload) => {
    const states = buildWorkload(workload.states);
    const compressed = paretoFrontier(states);
    const target = states[Math.floor(states.length / 2)];
    const queryAccuracy = Number(
      contains(target, compressed) === contains(target, states) &&
      reachable(target, compressed) === reachable(target, states) &&
      mustReach(target, compressed) === mustReach(target, states)
    );
    const compressedSize = compressed.length || 1;
    return {
      workload: workload.name,
      rawSize: states.length,
      compressedSize,
      semanticPreservation: queryAccuracy,
      kcr: queryAccuracy === 1 ? states.length / compressedSize : 0,
      proofSize: JSON.stringify(compressed, (_, v) => typeof v === "bigint" ? `${v}n` : v).length,
      syncCost: compressedSize
    };
  });

  const semanticPreservation = results.every((r) => r.semanticPreservation === 1) ? 1 : 0;
  const averageKcr = results.reduce((sum, r) => sum + r.kcr, 0) / results.length;

  return {
    candidate,
    semanticPreservation,
    averageKcr,
    workloads: results
  };
}

const ranked = rankRootIDs(candidates.map((candidate) => candidate.rootID), (rootID) => {
  const candidate = candidates.find((c) => c.rootID === rootID);
  const evaluation = evaluateCandidate(candidate);
  return evaluation.semanticPreservation ? evaluation.averageKcr : 0;
});

console.log(JSON.stringify({
  suite: "candidate-lab",
  ranked,
  candidates: candidates.map((candidate) => ({
    rootID: candidate.rootID,
    name: candidate.name,
    evaluation: evaluateCandidate(candidate)
  }))
}, null, 2));

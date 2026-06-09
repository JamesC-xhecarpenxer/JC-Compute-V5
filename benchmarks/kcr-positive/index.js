import { runWorkload } from "./runner.js";
import { reachableSmallWorkload } from "./workloads/reachable-small/index.js";
import { reachableMediumWorkload } from "./workloads/reachable-medium/index.js";
import { reachableLargeWorkload } from "./workloads/reachable-large/index.js";
import { reachableCyclicWorkload } from "./workloads/reachable-cyclic/index.js";
import { reachableBranchingWorkload } from "./workloads/reachable-branching/index.js";
import { reachableAdversarialWorkload } from "./workloads/reachable-adversarial/index.js";

const workloads = [
  reachableSmallWorkload,
  reachableMediumWorkload,
  reachableLargeWorkload,
  reachableCyclicWorkload,
  reachableBranchingWorkload,
  reachableAdversarialWorkload
];

const results = workloads.map((workload) => runWorkload(workload()));

console.log(JSON.stringify({
  suite: "kcr-positive",
  queryFamily: "reachable",
  results
}, null, 2));

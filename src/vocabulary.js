/**
 * Constitutional Commonwealth Vocabulary
 *
 * Both vocabularies work. The canonical compute names are unchanged;
 * this file exports every symbol a second time under its constitutional alias.
 *
 * Import the technical vocabulary:
 *   import { createNode, execute, stateRoot } from "./vocabulary.js"
 *
 * Import the constitutional vocabulary:
 *   import { createCitizen, administer, publicRecord } from "./vocabulary.js"
 *
 * Or mix:
 *   import { createCitizen as createNode, administer, stateRoot } from "./vocabulary.js"
 */

// ─── Core ────────────────────────────────────────────────────────────────────

export {
  normalize,
  hash,
  createField,
  cloneField,
  canonicalizeField,
  canonicalizeState,
  fieldRoot,
  applyReducer,
  stateRoot,
  rootOf,
  rootID,
  generateIRProposals,
  runConsensus,
  applyConsensusIR,
  runToFixedPoint,
  runFullPipeline,
  createDomainState,
  getDomainConfig,
  listDomains,
  runCrossDomainConvergence,
} from "./packages/packages/unistack-core/index.js";

// Constitutional aliases — Core
export {
  // hash → seal  (a hash is a cryptographic seal)
  hash as seal,
  // fieldRoot → greatSeal  (Merkle root → Great Seal)
  fieldRoot as greatSeal,
  stateRoot as commonwealthRecord,
  rootOf as constitutionalSeal,
  rootID as sealID,

  // IR generation = deliberation (the network deliberates on what to apply)
  generateIRProposals as deliberate,
  // Consensus run = election
  runConsensus as holdElection,
  applyConsensusIR as enactRuling,
  runToFixedPoint as administerUntilRatified,
  runFullPipeline as conductLegislativeProcess,

  // Domain helpers
  createDomainState as foundTerritory,
  getDomainConfig as getTerritoryCharter,
  listDomains as listTerritories,
  runCrossDomainConvergence as unionConvergence,
} from "./packages/packages/unistack-core/index.js";

// ─── Runtime ─────────────────────────────────────────────────────────────────

export {
  createNode,
  execute,
  scheduler,
  layerRegistry,
  createRuntimeFixedPointOperator,
} from "./packages/packages/unistack-runtime/index.js";

// Constitutional aliases — Runtime
export {
  // node = citizen (a node is a participant in the commonwealth)
  createNode as createCitizen,
  // execute = administer (the government administers the law)
  execute as administer,
  // scheduler = civilService (coordinates petitions across citizens)
  scheduler as civilService,
  // layerRegistry = publicRegistry
  layerRegistry as publicRegistry,
  createRuntimeFixedPointOperator as createGovernmentFixedPoint,
} from "./packages/packages/unistack-runtime/index.js";

// ─── Store ───────────────────────────────────────────────────────────────────

export {
  createStore,
  rootAddress,
} from "./packages/packages/unistack-store/index.js";

// Constitutional aliases — Store
export {
  // store = archive (the public record archive)
  createStore as createArchive,
  rootAddress as filingAddress,
} from "./packages/packages/unistack-store/index.js";

// ─── Sync ────────────────────────────────────────────────────────────────────

export {
  canonicalize,
  paretoFrontier,
  merge,
  syncStep,
  compareRoots,
  findDivergence,
  generateProof,
  applyDelta,
  syncRoot,
  deltaSync,
  proofFor,
  witnessFor,
  verifyWitness,
  containsProof,
  membershipProof,
  deltaProof,
  divergenceProof,
} from "./packages/packages/unistack-sync/index.js";

// Constitutional aliases — Sync
export {
  // merge = ratify (two branches ratify into one)
  merge as ratify,
  syncStep as propagateProceedings,
  compareRoots as compareSeals,
  findDivergence as findConstitutionalConflict,
  // proof = evidence
  generateProof as generateEvidence,
  applyDelta as applyAmendment,
  syncRoot as commonwealthSeal,
  deltaSync as synchronizeJurisdictions,
  // proofFor → evidenceFor
  proofFor as evidenceFor,
  // witnessFor → testimonyFor
  witnessFor as testimonyFor,
  verifyWitness as verifyTestimony,
  containsProof as containsEvidence,
  membershipProof as membershipEvidence,
  deltaProof as amendmentEvidence,
  divergenceProof as conflictEvidence,
} from "./packages/packages/unistack-sync/index.js";

// ─── Query ───────────────────────────────────────────────────────────────────

export {
  contains,
  reachable,
  mustHappen,
  mustReach,
  closure,
  fixpoint,
  frontier,
  proof,
  canHappen,
  frontierQueries,
  fixpointReached,
} from "./packages/packages/unistack-query/index.js";

// Constitutional aliases — Query
export {
  // reachable = jurisdictionallyReachable
  reachable as jurisdictionallyReachable,
  // mustHappen = constitutionallyRequired
  mustHappen as constitutionallyRequired,
  mustReach as mustReachRatification,
  // frontier = legislativeFrontier
  frontier as legislativeFrontier,
  // proof → evidence (query layer)
  proof as adjudicationEvidence,
  canHappen as mayProceed,
  frontierQueries as frontierPetitions,
  // fixpoint = ratificationReached
  fixpointReached as ratificationReached,
} from "./packages/packages/unistack-query/index.js";

// ─── Meta (search / evolution) ───────────────────────────────────────────────

export {
  evaluate,
  rank,
  search,
  evolve,
  searchRootIDs,
  rankRootIDs,
} from "./packages/packages/unistack-meta/index.js";

// Constitutional aliases — Meta
export {
  // evaluate = judiciallyReview
  evaluate as judiciallyReview,
  // rank = orderByMerit
  rank as orderByMerit,
  // search = conductElectoralSearch
  search as conductElectoralSearch,
  // evolve = amend (evolving candidates = amending proposals)
  evolve as amendCandidates,
  searchRootIDs as searchConstitutionalIDs,
  rankRootIDs as rankConstitutionalIDs,
} from "./packages/packages/unistack-meta/index.js";

// ─── Runtime: Fixed-Point Operator ───────────────────────────────────────────

export {
  createFixedPointOperator,
} from "./runtime/fixed-point-operator.js";

// Constitutional alias
export {
  createFixedPointOperator as createRatificationOperator,
} from "./runtime/fixed-point-operator.js";

// ─── Runtime: Quotient Space ─────────────────────────────────────────────────

export {
  representativeEntropy,
  representativeEntropyFromCounts,
  withinClassDistance,
  withinClassGeometry,
  canonicalizeOptional,
  unifiedQuotientInvariant,
  rootDivergenceDistance,
  quotientMetrics,
} from "./runtime/quotient-space.js";

// Constitutional aliases — Quotient Space
export {
  // representative entropy = diversity of the public record
  representativeEntropy as publicRecordDiversity,
  representativeEntropyFromCounts as publicRecordDiversityFromCounts,
  withinClassDistance as jurisdictionalDistance,
  withinClassGeometry as jurisdictionalGeometry,
  unifiedQuotientInvariant as unifiedConstitutionalInvariant,
  rootDivergenceDistance as sealDivergence,
  quotientMetrics as constitutionalMetrics,
} from "./runtime/quotient-space.js";

// ─── Runtime: Compression Phase Space ────────────────────────────────────────

export {
  slope,
  compressionPhaseVector,
  cpsDistance,
  clusterCpsVectors,
  basinConsistencyMap,
  trajectoryCoupling,
  perturbationResponse,
  perturbationMatrix,
  basinTransitionProbability,
  basinTransitionStatistics,
} from "./runtime/compression-phase-space.js";

// Constitutional aliases — Compression Phase Space
export {
  // compression phase vector = deliberation vector
  compressionPhaseVector as deliberationVector,
  cpsDistance as deliberationDistance,
  clusterCpsVectors as clusterDistricts,
  // basin = province (attractor basin = stable province)
  basinConsistencyMap as provinceConsistencyMap,
  trajectoryCoupling as proceedingsCoupling,
  perturbationResponse as constitutionalShockResponse,
  perturbationMatrix as constitutionalShockMatrix,
  basinTransitionProbability as provinceTransitionProbability,
  basinTransitionStatistics as provinceTransitionStatistics,
} from "./runtime/compression-phase-space.js";

// ─── Runtime: Oracle Consensus ───────────────────────────────────────────────

export {
  mergeProposalsCRDT,
} from "./runtime/oracle/oracle-consensus.js";

// Constitutional alias
export {
  // merging CRDT proposals = merging bills from multiple representatives
  mergeProposalsCRDT as mergeBillsCRDT,
} from "./runtime/oracle/oracle-consensus.js";

// ─── Runtime: Adversarial IR Generator ───────────────────────────────────────

export {
  createAdversarialGenerator,
} from "./runtime/adversarial-ir-generator.js";

// Constitutional alias
export {
  // adversarial generator = opposition (stress-tests the system like political opposition)
  createAdversarialGenerator as createOpposition,
} from "./runtime/adversarial-ir-generator.js";

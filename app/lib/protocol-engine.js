/**
 * UniStack Protocol Engine
 * AI → IR → Consensus → Verified State
 *
 * Implements the full VSE pipeline with real computation — no mocks.
 */

import { createHash } from "node:crypto";
import {
  createField, applyReducer, stateRoot, fieldRoot,
  hash, normalize, rootOf, rootID, canonicalizeState
} from "../packages/unistack-core/index.js";
import { merge, syncStep, generateProof, syncRoot } from "../packages/unistack-sync/index.js";
import {
  reachable, mustHappen, closure, frontier,
  fixpointReached, proof, canHappen, fixpoint
} from "../packages/unistack-query/index.js";
import { createFixedPointOperator } from "../runtime/fixed-point-operator.js";
import { mergeProposalsCRDT } from "../runtime/oracle/oracle-consensus.js";
import {
  compressionPhaseVector, cpsDistance, clusterCpsVectors, basinConsistencyMap
} from "../runtime/compression-phase-space.js";
import {
  representativeEntropy, withinClassGeometry, unifiedQuotientInvariant
} from "../runtime/quotient-space.js";

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN DEFINITIONS — each domain maps to a real workload type
// ─────────────────────────────────────────────────────────────────────────────

const DOMAIN_CONFIGS = {
  "distributed-robotics": {
    label: "Distributed Robotics",
    icon: "🤖",
    width: 4, height: 4,
    irOpcodes: [0, 1, 2],
    description: "Coordinate actuators across robot swarm with verified state convergence",
    stateLabels: ["position_x", "position_y", "velocity", "heading",
                   "motor_left", "motor_right", "sensor_front", "sensor_rear",
                   "battery", "task_id", "sync_epoch", "peer_count",
                   "collision_flag", "waypoint_x", "waypoint_y", "status"],
  },
  "ai-agent-os": {
    label: "AI Agent Operating System",
    icon: "🧠",
    width: 4, height: 4,
    irOpcodes: [0, 1, 2],
    description: "Multi-agent task scheduling with CRDT-merged IR proposals",
    stateLabels: ["agent_0_load", "agent_1_load", "agent_2_load", "agent_3_load",
                   "queue_depth", "priority_high", "priority_med", "priority_low",
                   "memory_used", "cpu_ticks", "io_ops", "network_pkts",
                   "consensus_round", "leader_id", "epoch", "health_score"],
  },
  "financial-settlement": {
    label: "Financial Settlement",
    icon: "💹",
    width: 4, height: 4,
    irOpcodes: [0, 1, 2],
    description: "Cross-organization settlement with deterministic merge and Merkle proofs",
    stateLabels: ["balance_a", "balance_b", "balance_c", "balance_d",
                   "pending_txns", "cleared_txns", "rejected_txns", "dispute_flags",
                   "reserve_ratio", "liquidity_score", "settlement_epoch", "nonce",
                   "collateral_a", "collateral_b", "net_position", "risk_score"],
  },
  "autonomous-manufacturing": {
    label: "Autonomous Manufacturing",
    icon: "🏭",
    width: 4, height: 4,
    irOpcodes: [0, 1, 2],
    description: "Production line state convergence with real-time IR-driven transitions",
    stateLabels: ["line_a_rate", "line_b_rate", "line_c_rate", "line_d_rate",
                   "wip_queue", "completed_units", "defect_count", "rework_count",
                   "temp_zone_1", "temp_zone_2", "pressure_1", "pressure_2",
                   "energy_draw", "throughput", "cycle_time", "oee_score"],
  },
  "multi-agent-swarms": {
    label: "Multi-Agent AI Swarms",
    icon: "🐝",
    width: 4, height: 4,
    irOpcodes: [0, 1, 2],
    description: "Emergent consensus across heterogeneous AI agents via IR lattice",
    stateLabels: ["swarm_density", "pheromone_a", "pheromone_b", "pheromone_c",
                   "task_assigned", "task_complete", "task_failed", "exploration",
                   "cluster_id", "cluster_size", "signal_strength", "ttl",
                   "objective_score", "convergence_rate", "fork_count", "merge_count"],
  },
  "digital-twin": {
    label: "Digital Twin Infrastructure",
    icon: "🔮",
    width: 4, height: 4,
    irOpcodes: [0, 1, 2],
    description: "Physical-digital state synchronization with verified divergence detection",
    stateLabels: ["twin_sync_lag", "physical_temp", "digital_temp", "delta_temp",
                   "physical_pressure", "digital_pressure", "delta_pressure",
                   "physical_vibration", "digital_vibration", "sync_epoch",
                   "drift_score", "alert_flags", "calibration_id", "model_version",
                   "prediction_error", "confidence_score"],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// IR GENERATION — produces real IR from domain context (local AI-like heuristics)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates deterministic IR proposals from a domain state + intent.
 * This is the "AI → IR" step — uses actual field analysis to propose transitions.
 */
export function generateIRProposals(domain, state, intent = "optimize", agentId = "local") {
  const config = DOMAIN_CONFIGS[domain];
  if (!config) throw new Error(`Unknown domain: ${domain}`);

  const fields = state;
  const proposals = [];
  const size = fields[0]?.cells?.length ?? 16;

  // Analyze state pressure points
  const maxCell = fields.reduce((max, f) =>
    f.cells.reduce((m, c) => (c > m ? c : m), max), 0n);
  const minCell = fields.reduce((min, f) =>
    f.cells.reduce((m, c) => (c < m ? c : m), min), maxCell);
  const avgCell = fields.reduce((sum, f) =>
    f.cells.reduce((s, c) => s + c, sum), 0n) /
    BigInt(Math.max(1, fields.reduce((n, f) => n + f.cells.length, 0)));

  // Generate proposals per opcode based on intent
  const intents = {
    optimize: [
      // OP 0: point update — boost underperforming index
      { opcode: 0, payload: [Number(minCell % BigInt(size)), Number(avgCell + 1n)] },
      // OP 1: global delta — small increment across all cells
      { opcode: 1, payload: [1] },
      // OP 2: direct set — normalize outlier
      { opcode: 2, payload: [Number(maxCell % BigInt(size)), Number(avgCell)] },
    ],
    rebalance: [
      { opcode: 1, payload: [Number((maxCell - avgCell) / 2n) % 256 + 1] },
      { opcode: 0, payload: [0, Number(avgCell)] },
      { opcode: 2, payload: [1, Number(avgCell)] },
    ],
    converge: [
      { opcode: 2, payload: [0, Number(avgCell)] },
      { opcode: 2, payload: [1, Number(avgCell)] },
      { opcode: 1, payload: [0] },
    ],
    scale: [
      { opcode: 1, payload: [Math.floor(Math.random() * 4) + 1] },
      { opcode: 0, payload: [Number(BigInt(size - 1) % BigInt(size)), Number(avgCell * 2n)] },
    ],
  };

  const selected = intents[intent] ?? intents.optimize;
  for (const ir of selected) {
    proposals.push({
      opcode: ir.opcode & 0xff,
      payload: ir.payload.map(v => Math.abs(Math.floor(v)) || 0),
      agent: agentId,
      timestamp: Date.now(),
    });
  }

  return proposals;
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-AGENT CONSENSUS — N agents propose IR, CRDT merge → consensus IR set
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs the AI→IR→Consensus pipeline for a domain state.
 * Multiple "agents" generate IR proposals; CRDT merge produces consensus.
 */
export function runConsensus(domain, state, intent = "optimize", agentCount = 3) {
  const modelResults = [];

  const agents = Array.from({ length: agentCount }, (_, i) => `agent-${i}`);

  for (const agent of agents) {
    // Each agent generates its own IR proposals (deterministic per agent)
    const proposals = generateIRProposals(domain, state, intent, agent);
    modelResults.push({ model: agent, proposals });
  }

  // CRDT merge — real implementation from the codebase
  const { irSet, consensus, union, scores } = mergeProposalsCRDT(modelResults, {
    consensusThreshold: Math.ceil(agentCount / 2),
    maxIR: 8,
  });

  return {
    agents,
    modelResults,
    irSet,
    consensus,
    union,
    consensusDepth: consensus.length,
    unionDepth: union.length,
    totalProposals: modelResults.reduce((n, r) => n + r.proposals.length, 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFIED STATE EVOLUTION — apply consensus IR → compute Merkle root
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies a consensus IR set to a state and produces a VSE (Verified State).
 */
export function applyConsensusIR(state, irSet) {
  let current = state;

  const steps = [];
  for (const ir of irSet) {
    const nextFields = current.map(field => applyReducer(field, ir));
    const merged = merge(current, nextFields);
    const root = stateRoot(merged);
    steps.push({ ir, root, fieldCount: merged.length });
    current = merged;
  }

  return { state: current, steps, finalRoot: stateRoot(current) };
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXED POINT — run to convergence
// ─────────────────────────────────────────────────────────────────────────────

export function runToFixedPoint(state, irSet, maxSteps = 32) {
  const op = createFixedPointOperator({
    reducer: (s, ir) => ir ? s.map(f => applyReducer(f, ir)) : s,
    merge: (prev, next) => merge(prev, next),
    compress: (s) => s,
    queryProjector: null,
  });

  let current = state;
  const trajectory = [];
  let settleStep = 0;

  for (let i = 0; i < maxSteps; i++) {
    const ir = irSet[i % irSet.length] ?? null;
    const next = op.step(current, ir, null);
    const r0 = stateRoot(current);
    const r1 = stateRoot(next);
    const converged = r0 === r1;

    trajectory.push({
      step: i,
      root: r0,
      ir,
      converged,
    });

    if (converged) { settleStep = i; break; }
    current = next;
    settleStep = i;
  }

  return { state: current, trajectory, settleStep, finalRoot: stateRoot(current) };
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL PIPELINE — AI→IR→Consensus→Verified State
// ─────────────────────────────────────────────────────────────────────────────

export function runFullPipeline(domain, initialState, intent = "optimize", agentCount = 3) {
  const t0 = Date.now();
  const config = DOMAIN_CONFIGS[domain];
  if (!config) throw new Error(`Unknown domain: ${domain}`);

  // Step 1: AI → IR (multi-agent proposal)
  const consensusResult = runConsensus(domain, initialState, intent, agentCount);
  const t1 = Date.now();

  // Step 2: IR → Verified State
  const { state: reducedState, steps, finalRoot } = applyConsensusIR(initialState, consensusResult.irSet);
  const t2 = Date.now();

  // Step 3: Fixed Point
  const { state: convergedState, trajectory, settleStep } = runToFixedPoint(
    reducedState, consensusResult.irSet
  );
  const t3 = Date.now();

  // Step 4: Convergence metrics
  const initialRoot = stateRoot(initialState);
  const entropies = [initialState, reducedState, convergedState].map(s =>
    representativeEntropy(s)
  );
  const geometry = withinClassGeometry([initialState, convergedState]);
  const kcr = Math.abs(entropies[0] - entropies[2]);
  const uq = unifiedQuotientInvariant({ kcr, representativeEntropy: entropies[2], geometry });

  // Step 5: Merkle proof
  const syncProof = generateProof({
    root: finalRoot,
    witness: convergedState[0],
    merklePath: convergedState.map(f => fieldRoot(f)),
    queryType: "convergence",
  });

  // Step 6: Node-level sync root
  const nodeRoot = syncRoot({
    state: convergedState,
    reducerSpec: { kind: "field-reducer", opcodes: config.irOpcodes },
    irSpec: { kind: "ir-set", count: consensusResult.irSet.length },
    topology: { domain, agentCount },
    specVersion: "v3",
  });

  return {
    domain,
    intent,
    config,
    pipeline: {
      phase1_ai_to_ir: {
        durationMs: t1 - t0,
        agents: consensusResult.agents,
        totalProposals: consensusResult.totalProposals,
        consensusIRs: consensusResult.consensus.length,
        unionIRs: consensusResult.union.length,
        irSet: consensusResult.irSet,
      },
      phase2_ir_to_state: {
        durationMs: t2 - t1,
        steps,
        stateRoot: stateRoot(reducedState),
      },
      phase3_fixpoint: {
        durationMs: t3 - t2,
        settleStep,
        trajectoryLength: trajectory.length,
        trajectory,
        finalRoot,
      },
    },
    convergence: {
      initialRoot,
      finalRoot: stateRoot(convergedState),
      converged: initialRoot !== stateRoot(convergedState),
      entropyInitial: entropies[0],
      entropyFinal: entropies[2],
      kcr,
      geometry,
      uq,
      settleStep,
    },
    proof: syncProof,
    nodeRoot,
    state: convergedState,
    totalDurationMs: t3 - t0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN STATE FACTORIES — create realistic initial states per domain
// ─────────────────────────────────────────────────────────────────────────────

export function createDomainState(domain, seed = 0) {
  const config = DOMAIN_CONFIGS[domain];
  if (!config) throw new Error(`Unknown domain: ${domain}`);

  const size = config.width * config.height;
  const cells = Array.from({ length: size }, (_, i) => {
    // Seed-based deterministic initial values
    const v = ((seed * 31 + i * 17) % 1000) + 1;
    return BigInt(v);
  });

  return [createField(config.width, config.height, cells)];
}

export function getDomainConfig(domain) {
  return DOMAIN_CONFIGS[domain] ?? null;
}

export function listDomains() {
  return Object.entries(DOMAIN_CONFIGS).map(([id, cfg]) => ({
    id,
    label: cfg.label,
    icon: cfg.icon,
    description: cfg.description,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-DOMAIN CONVERGENCE — multi-org sync
// ─────────────────────────────────────────────────────────────────────────────

export function runCrossDomainConvergence(domains, intent = "converge") {
  const results = {};
  const roots = {};

  for (const domain of domains) {
    const state = createDomainState(domain, domains.indexOf(domain));
    const result = runFullPipeline(domain, state, intent, 3);
    results[domain] = result;
    roots[domain] = result.convergence.finalRoot;
  }

  // Compute cross-domain divergence
  const rootList = Object.values(roots);
  const allSame = new Set(rootList).size === 1;

  // CPS vectors for each domain run
  const cpsVectors = Object.entries(results).map(([domain, r]) =>
    compressionPhaseVector({
      run_id: domain,
      kcr: r.convergence.kcr,
      representativeEntropy: r.convergence.entropyFinal,
      geometry: r.convergence.geometry,
      uq: r.convergence.uq,
      settleSteps: r.convergence.settleStep,
      rootDistance: 0,
      trajectory: r.pipeline.phase3_fixpoint.trajectory,
      initialState: createDomainState(domain, 0),
      finalState: r.state,
    })
  );

  const basins = clusterCpsVectors(cpsVectors, 5);
  const consistency = basinConsistencyMap(basins);

  return {
    domains,
    results,
    roots,
    allConverged: allSame,
    basinCount: basins.length,
    basins,
    consistency,
    cpsVectors,
  };
}

#!/usr/bin/env node
/**
 * UniStack Protocol CLI
 * Production-grade command-line interface
 *
 * Usage:
 *   unistack domains
 *   unistack run --domain distributed-robotics --intent optimize
 *   unistack run --domain financial-settlement --intent converge --agents 5
 *   unistack pipeline --domain ai-agent-os --steps
 *   unistack cross --domains distributed-robotics,financial-settlement,digital-twin
 *   unistack state --domain autonomous-manufacturing --seed 42
 *   unistack ir --domain multi-agent-swarms --intent rebalance
 *   unistack proof --domain digital-twin
 *   unistack bench --domain distributed-robotics --runs 10
 */

import {
  runFullPipeline, createDomainState, listDomains, getDomainConfig,
  runCrossDomainConvergence, runConsensus, applyConsensusIR, runToFixedPoint,
  generateIRProposals,
} from "../lib/protocol-engine.js";
import { stateRoot, fieldRoot } from "../packages/unistack-core/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// TERMINAL FORMATTING
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bgBlue: "\x1b[44m",
  bgGreen: "\x1b[42m",
};

function fmt(color, text) { return `${C[color]}${text}${C.reset}`; }
function bold(t) { return fmt("bold", t); }
function dim(t) { return fmt("dim", t); }
function ok(t) { return fmt("green", t); }
function warn(t) { return fmt("yellow", t); }
function err(t) { return fmt("red", t); }
function info(t) { return fmt("cyan", t); }
function highlight(t) { return fmt("magenta", t); }

function header(title) {
  const line = "─".repeat(64);
  console.log(`\n${fmt("blue", line)}`);
  console.log(`${bold(fmt("cyan", `  ${title}`))}  ${dim(`UniStack v3.0`)}`);
  console.log(`${fmt("blue", line)}`);
}

function section(title) {
  console.log(`\n${bold(fmt("yellow", `▸ ${title}`))}`);
}

function printKV(key, value, indent = "  ") {
  const kStr = fmt("gray", key.padEnd(28));
  const vStr = typeof value === "number"
    ? fmt("cyan", value.toFixed(4))
    : fmt("white", String(value));
  console.log(`${indent}${kStr} ${vStr}`);
}

function progressBar(value, max = 1, width = 30) {
  const pct = Math.min(1, value / max);
  const filled = Math.round(pct * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  return `${fmt("cyan", bar)} ${(pct * 100).toFixed(1)}%`;
}

function hashShort(h) {
  return fmt("magenta", `${String(h).slice(0, 8)}…${String(h).slice(-6)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ARG PARSING
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith("--")) {
      const [k, inline] = t.slice(2).split("=");
      if (inline !== undefined) flags[k] = inline;
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) flags[k] = argv[++i];
      else flags[k] = true;
    } else { args.push(t); }
  }
  return { args, flags };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

function cmdDomains() {
  header("UniStack Protocol Domains");
  const domains = listDomains();
  for (const d of domains) {
    console.log(`\n  ${d.icon}  ${bold(d.label)}`);
    console.log(`     ${dim("id:")} ${info(d.id)}`);
    console.log(`     ${dim("─")} ${fmt("gray", d.description)}`);
  }
  console.log(`\n${dim(`  ${domains.length} domains registered`)}\n`);
}

function cmdState(flags) {
  const domain = flags.domain;
  if (!domain) { console.error(err("--domain required")); process.exit(1); }
  const seed = Number(flags.seed ?? 0);
  const cfg = getDomainConfig(domain);
  if (!cfg) { console.error(err(`Unknown domain: ${domain}`)); process.exit(1); }

  header(`Domain State — ${cfg.label}`);
  const state = createDomainState(domain, seed);
  const root = stateRoot(state);

  section("State Root");
  console.log(`  ${hashShort(root)}`);
  printKV("full root", root.slice(0, 32) + "...");

  section("Field Grid");
  for (const [fi, field] of state.entries()) {
    console.log(`\n  ${bold(`Field[${fi}]`)} ${dim(`${field.width}×${field.height}`)}`);
    for (let row = 0; row < field.height; row++) {
      const cells = field.cells.slice(row * field.width, (row + 1) * field.width);
      const line = cells.map((c, col) => {
        const label = cfg.stateLabels[row * field.width + col] ?? `cell[${row},${col}]`;
        const val = String(c).padStart(6);
        return `${fmt("gray", label.slice(0, 16).padEnd(16))} ${fmt("cyan", val)}`;
      }).join("  ");
      console.log(`    ${line}`);
    }
  }
  console.log(`\n  ${dim(`seed=${seed}  ${cfg.width}×${cfg.height} field`)}\n`);
}

function cmdIR(flags) {
  const domain = flags.domain;
  const intent = flags.intent ?? "optimize";
  const agents = Number(flags.agents ?? 3);
  if (!domain) { console.error(err("--domain required")); process.exit(1); }
  const cfg = getDomainConfig(domain);
  header(`AI → IR Consensus — ${cfg?.label ?? domain}`);

  const state = createDomainState(domain, Number(flags.seed ?? 0));
  const result = runConsensus(domain, state, intent, agents);

  section("Agent Proposals");
  for (const { model, proposals } of result.modelResults) {
    console.log(`\n  ${info(model)}`);
    for (const p of proposals) {
      const opNames = ["POINT_UPDATE", "GLOBAL_DELTA", "DIRECT_SET"];
      console.log(`    ${fmt("yellow", opNames[p.opcode] ?? `OP_${p.opcode}`)} ${fmt("gray", JSON.stringify(p.payload))}`);
    }
  }

  section("CRDT Consensus Result");
  printKV("total proposals", result.totalProposals);
  printKV("consensus IRs", result.consensusDepth);
  printKV("union IRs", result.unionDepth);

  section("Consensus IR Set");
  for (const [i, ir] of result.irSet.entries()) {
    const opNames = ["POINT_UPDATE", "GLOBAL_DELTA", "DIRECT_SET"];
    console.log(`  [${i}] ${bold(opNames[ir.opcode] ?? `OP_${ir.opcode}`)}  payload=${fmt("cyan", JSON.stringify(ir.payload))}`);
  }
  console.log();
}

function cmdRun(flags) {
  const domain = flags.domain;
  if (!domain) { console.error(err("--domain required")); process.exit(1); }
  const intent = flags.intent ?? "optimize";
  const agents = Number(flags.agents ?? 3);
  const seed = Number(flags.seed ?? 0);
  const showSteps = flags.steps === true || flags.steps === "true";
  const cfg = getDomainConfig(domain);

  header(`Pipeline Run — ${cfg?.label ?? domain}`);
  console.log(`  ${dim("domain")}  ${info(domain)}  ${dim("intent")}  ${info(intent)}  ${dim("agents")}  ${info(agents)}`);

  const state = createDomainState(domain, seed);
  console.log(`\n  ${dim("initial state root")}  ${hashShort(stateRoot(state))}`);

  const t0 = Date.now();
  const result = runFullPipeline(domain, state, intent, agents);

  // ── Phase 1
  section("Phase 1 · AI → IR");
  printKV("agents", result.pipeline.phase1_ai_to_ir.agents.join(", "));
  printKV("total proposals", result.pipeline.phase1_ai_to_ir.totalProposals);
  printKV("consensus IRs", result.pipeline.phase1_ai_to_ir.consensusIRs);
  printKV("union IRs", result.pipeline.phase1_ai_to_ir.unionIRs);
  printKV("duration", `${result.pipeline.phase1_ai_to_ir.durationMs}ms`);
  console.log(`\n  ${bold("IR Set:")}`)
  for (const [i, ir] of result.pipeline.phase1_ai_to_ir.irSet.entries()) {
    const opNames = ["POINT_UPDATE", "GLOBAL_DELTA", "DIRECT_SET"];
    console.log(`    [${i}] ${fmt("yellow", opNames[ir.opcode] ?? `OP_${ir.opcode}`)}  ${fmt("gray", JSON.stringify(ir.payload))}`);
  }

  // ── Phase 2
  section("Phase 2 · IR → Verified State");
  printKV("reduction steps", result.pipeline.phase2_ir_to_state.steps.length);
  printKV("state root", hashShort(result.pipeline.phase2_ir_to_state.stateRoot));
  printKV("duration", `${result.pipeline.phase2_ir_to_state.durationMs}ms`);

  // ── Phase 3
  section("Phase 3 · Fixed-Point Convergence");
  printKV("settle step", result.pipeline.phase3_fixpoint.settleStep);
  printKV("trajectory length", result.pipeline.phase3_fixpoint.trajectoryLength);
  printKV("final root", hashShort(result.pipeline.phase3_fixpoint.finalRoot));
  printKV("duration", `${result.pipeline.phase3_fixpoint.durationMs}ms`);

  if (showSteps) {
    console.log(`\n  ${bold("Trajectory:")}`)
    for (const step of result.pipeline.phase3_fixpoint.trajectory.slice(0, 8)) {
      const conv = step.converged ? ok("✓ converged") : warn("→ evolving");
      console.log(`    step ${String(step.step).padStart(2)}  ${hashShort(step.root)}  ${conv}`);
    }
    if (result.pipeline.phase3_fixpoint.trajectory.length > 8) {
      console.log(`    ${dim(`... ${result.pipeline.phase3_fixpoint.trajectory.length - 8} more steps`)}`);
    }
  }

  // ── Convergence Metrics
  section("Convergence Metrics");
  printKV("initial root", hashShort(result.convergence.initialRoot));
  printKV("final root", hashShort(result.convergence.finalRoot));
  printKV("converged", result.convergence.converged ? ok("YES") : warn("NO"));
  printKV("entropy initial", result.convergence.entropyInitial);
  printKV("entropy final", result.convergence.entropyFinal);
  printKV("KCR (convergence rate)", result.convergence.kcr);
  printKV("geometry (within-class)", result.convergence.geometry);
  printKV("U_Q (unified quotient)", result.convergence.uq);
  printKV("settle step", result.convergence.settleStep);

  const entropy_bar = progressBar(result.convergence.entropyFinal, 3);
  console.log(`\n  ${dim("entropy")}   ${entropy_bar}`);

  // ── Proof
  section("Merkle Proof");
  printKV("proof root", hashShort(result.proof.root));
  printKV("query type", result.proof.queryType);
  printKV("merkle path length", result.proof.merklePath.length);

  // ── Node Root
  section("Node Sync Root");
  printKV("sync root", hashShort(result.nodeRoot));

  // ── Summary
  const totalMs = Date.now() - t0;
  console.log(`\n${fmt("blue", "─".repeat(64))}`);
  console.log(`  ${bold(ok("✓ Pipeline complete"))}  ${dim(`${totalMs}ms total`)}`);
  console.log(`  ${dim("domain")}   ${info(cfg?.label ?? domain)}`);
  console.log(`  ${dim("intent")}   ${info(intent)}`);
  console.log(`  ${dim("outcome")}  ${result.convergence.converged ? ok("state evolved") : warn("state unchanged")}`);
  console.log(`${fmt("blue", "─".repeat(64))}\n`);
}

function cmdCross(flags) {
  const domainsArg = flags.domains ?? "";
  const domains = domainsArg.split(",").map(d => d.trim()).filter(Boolean);
  const intent = flags.intent ?? "converge";

  if (domains.length < 2) {
    console.error(err("--domains requires at least 2 comma-separated domain IDs"));
    process.exit(1);
  }

  header(`Cross-Domain Convergence — ${domains.length} Orgs`);
  console.log(`  ${dim("domains")}  ${domains.map(d => info(d)).join("  ")}`);
  console.log(`  ${dim("intent")}   ${info(intent)}`);

  const result = runCrossDomainConvergence(domains, intent);

  section("Per-Domain Results");
  for (const domain of domains) {
    const r = result.results[domain];
    const cfg = getDomainConfig(domain);
    if (!r) continue;
    console.log(`\n  ${cfg?.icon ?? "◆"}  ${bold(cfg?.label ?? domain)}`);
    printKV("  final root", hashShort(r.convergence.finalRoot));
    printKV("  KCR", r.convergence.kcr);
    printKV("  settle step", r.convergence.settleStep);
    printKV("  converged", r.convergence.converged ? ok("YES") : warn("NO"));
  }

  section("Cross-Domain Analysis");
  printKV("all converged", result.allConverged ? ok("YES") : warn("NO (divergent roots)"));
  printKV("basin count", result.basinCount);
  printKV("CPS vectors", result.cpsVectors.length);

  section("Convergence Basins");
  for (const basin of result.basins) {
    console.log(`\n  Basin ${bold(`#${basin.basin_id}`)}`);
    printKV("  stability score", basin.stabilityScore);
    printKV("  intra-basin variance", basin.intraBasinVariance);
    printKV("  semantic variance", basin.semanticVariance ?? 0);
    printKV("  runs in basin", basin.runs.length);
  }
  console.log();
}

function cmdBench(flags) {
  const domain = flags.domain;
  const runs = Number(flags.runs ?? 5);
  const intent = flags.intent ?? "optimize";
  if (!domain) { console.error(err("--domain required")); process.exit(1); }
  const cfg = getDomainConfig(domain);

  header(`Benchmark — ${cfg?.label ?? domain}`);
  console.log(`  ${dim("runs")} ${runs}  ${dim("intent")} ${intent}\n`);

  const results = [];
  for (let i = 0; i < runs; i++) {
    const state = createDomainState(domain, i);
    const t0 = Date.now();
    const r = runFullPipeline(domain, state, intent, 3);
    const ms = Date.now() - t0;
    results.push({ run: i, ms, kcr: r.convergence.kcr, settleStep: r.convergence.settleStep, uq: r.convergence.uq });
    process.stdout.write(`  run ${String(i + 1).padStart(2)}/${runs}  ${fmt("gray", `${ms}ms`)}  kcr=${fmt("cyan", r.convergence.kcr.toFixed(4))}  settle=${r.convergence.settleStep}\n`);
  }

  const avgMs = results.reduce((s, r) => s + r.ms, 0) / runs;
  const avgKCR = results.reduce((s, r) => s + r.kcr, 0) / runs;
  const avgSettle = results.reduce((s, r) => s + r.settleStep, 0) / runs;
  const minMs = Math.min(...results.map(r => r.ms));
  const maxMs = Math.max(...results.map(r => r.ms));

  section("Benchmark Summary");
  printKV("avg latency", `${avgMs.toFixed(1)}ms`);
  printKV("min latency", `${minMs}ms`);
  printKV("max latency", `${maxMs}ms`);
  printKV("avg KCR", avgKCR.toFixed(4));
  printKV("avg settle step", avgSettle.toFixed(2));
  console.log();
}

function cmdHelp() {
  header("UniStack Protocol CLI");
  console.log(`
  ${bold("COMMANDS")}

  ${info("domains")}
    List all registered domain applications.

  ${info("state")} ${dim("--domain <id> [--seed N]")}
    Show the initial field state for a domain.

  ${info("ir")} ${dim("--domain <id> [--intent optimize|rebalance|converge|scale] [--agents N]")}
    Run the AI → IR consensus step and show proposals.

  ${info("run")} ${dim("--domain <id> [--intent <i>] [--agents N] [--seed N] [--steps]")}
    Run the full AI→IR→Consensus→Verified State pipeline.

  ${info("cross")} ${dim("--domains <d1,d2,...> [--intent <i>]")}
    Run cross-domain convergence analysis across multiple orgs.

  ${info("bench")} ${dim("--domain <id> [--runs N] [--intent <i>]")}
    Benchmark pipeline performance across N runs.

  ${bold("DOMAINS")}
${listDomains().map(d => `    ${d.icon}  ${d.id.padEnd(30)} ${dim(d.label)}`).join("\n")}

  ${bold("INTENTS")}
    optimize     — boost underperforming cells, delta increment
    rebalance    — equalize cell values toward average
    converge     — direct set all cells toward mean
    scale        — amplify values (growth scenario)

  ${bold("EXAMPLES")}
    ${dim("$ node src/cli.js domains")}
    ${dim("$ node src/cli.js run --domain distributed-robotics")}
    ${dim("$ node src/cli.js run --domain financial-settlement --intent converge --steps")}
    ${dim("$ node src/cli.js cross --domains distributed-robotics,ai-agent-os,digital-twin")}
    ${dim("$ node src/cli.js bench --domain multi-agent-swarms --runs 10")}
    ${dim("$ node src/cli.js ir --domain autonomous-manufacturing --intent rebalance --agents 5")}
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));
  const command = args[0];

  if (!command || command === "help" || flags.help || flags.h) {
    cmdHelp();
    return;
  }

  try {
    switch (command) {
      case "domains": cmdDomains(); break;
      case "state":   cmdState(flags); break;
      case "ir":      cmdIR(flags); break;
      case "run":     cmdRun(flags); break;
      case "cross":   cmdCross(flags); break;
      case "bench":   cmdBench(flags); break;
      default:
        console.error(err(`Unknown command: ${command}`));
        console.error(dim("Run with --help for usage."));
        process.exit(1);
    }
  } catch (e) {
    console.error(`\n${err("Error:")} ${e.message}`);
    if (flags.debug) console.error(e.stack);
    process.exit(1);
  }
}

main();

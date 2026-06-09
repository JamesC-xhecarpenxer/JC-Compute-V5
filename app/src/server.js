/**
 * UniStack Protocol Server
 * REST API + SSE for real-time pipeline execution
 */

import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  runFullPipeline, createDomainState, listDomains,
  getDomainConfig, runCrossDomainConvergence, generateIRProposals,
  runConsensus, applyConsensusIR, runToFixedPoint,
} from "../lib/protocol-engine.js";
import { stateRoot } from "../packages/unistack-core/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// CORS for local dev
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// REST ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// List all domains
app.get("/api/domains", (req, res) => {
  res.json(listDomains());
});

// Get domain config
app.get("/api/domains/:domain", (req, res) => {
  const cfg = getDomainConfig(req.params.domain);
  if (!cfg) return res.status(404).json({ error: "Unknown domain" });
  res.json(cfg);
});

// Create initial state for domain
app.get("/api/domains/:domain/state", (req, res) => {
  try {
    const state = createDomainState(req.params.domain, Number(req.query.seed ?? 0));
    const root = stateRoot(state);
    const cfg = getDomainConfig(req.params.domain);
    res.json({
      domain: req.params.domain,
      root,
      fields: state.map(f => ({
        width: f.width,
        height: f.height,
        cells: f.cells.map(c => c.toString()),
      })),
      labels: cfg?.stateLabels ?? [],
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Run full pipeline (POST body: { domain, intent, agentCount, seed })
app.post("/api/pipeline/run", (req, res) => {
  try {
    const { domain, intent = "optimize", agentCount = 3, seed = 0 } = req.body;
    if (!domain) return res.status(400).json({ error: "domain is required" });

    const state = createDomainState(domain, seed);
    const result = runFullPipeline(domain, state, intent, agentCount);

    // Serialize BigInts
    res.json(JSON.parse(JSON.stringify(result, (_, v) =>
      typeof v === "bigint" ? v.toString() : v
    )));
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

// AI → IR step only
app.post("/api/pipeline/ir", (req, res) => {
  try {
    const { domain, intent = "optimize", agentCount = 3, seed = 0 } = req.body;
    const state = createDomainState(domain, seed);
    const result = runConsensus(domain, state, intent, agentCount);
    res.json(JSON.parse(JSON.stringify(result)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Cross-domain convergence
app.post("/api/pipeline/cross-domain", (req, res) => {
  try {
    const { domains, intent = "converge" } = req.body;
    if (!domains || !Array.isArray(domains)) {
      return res.status(400).json({ error: "domains array required" });
    }
    const result = runCrossDomainConvergence(domains, intent);
    res.json(JSON.parse(JSON.stringify(result, (_, v) =>
      typeof v === "bigint" ? v.toString() : v
    )));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SSE — streaming pipeline execution
// ─────────────────────────────────────────────────────────────────────────────

app.get("/api/pipeline/stream", (req, res) => {
  const { domain, intent = "optimize", agentCount = "3", seed = "0" } = req.query;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  function send(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data, (_, v) =>
      typeof v === "bigint" ? v.toString() : v
    )}\n\n`);
  }

  try {
    const state = createDomainState(domain, Number(seed));
    const root0 = stateRoot(state);

    send("start", { domain, intent, root: root0, timestamp: Date.now() });

    // Phase 1: AI → IR
    send("phase", { phase: 1, label: "AI → IR", status: "running" });
    const consensusResult = runConsensus(domain, state, intent, Number(agentCount));
    send("phase", {
      phase: 1, label: "AI → IR", status: "done",
      irSet: consensusResult.irSet,
      agents: consensusResult.agents,
      consensusDepth: consensusResult.consensusDepth,
      totalProposals: consensusResult.totalProposals,
    });

    // Phase 2: IR → State
    send("phase", { phase: 2, label: "IR → Verified State", status: "running" });
    const { state: reduced, steps, finalRoot } = applyConsensusIR(state, consensusResult.irSet);
    send("phase", {
      phase: 2, label: "IR → Verified State", status: "done",
      stateRoot: stateRoot(reduced),
      steps: steps.length,
      finalRoot,
    });

    // Phase 3: Fixed Point
    send("phase", { phase: 3, label: "Convergence", status: "running" });
    const { state: converged, trajectory, settleStep } = runToFixedPoint(reduced, consensusResult.irSet);

    // Stream each trajectory step
    for (const step of trajectory.slice(0, 10)) {
      send("step", step);
    }

    send("phase", {
      phase: 3, label: "Convergence", status: "done",
      settleStep,
      trajectoryLength: trajectory.length,
      finalRoot: stateRoot(converged),
    });

    send("complete", {
      initialRoot: root0,
      finalRoot: stateRoot(converged),
      converged: root0 !== stateRoot(converged),
      settleStep,
      totalSteps: trajectory.length,
    });

    res.end();
  } catch (e) {
    send("error", { message: e.message });
    res.end();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// OLLAMA CONFIG — local inference (Mistral + Llama3.2), optimised for Apple M1
// ─────────────────────────────────────────────────────────────────────────────

const OLLAMA_BASE = process.env.OLLAMA_HOST || "http://localhost:11434";

// Model preference order: use CHAT_MODEL env var to override, else try mistral
// then llama3.2 as fallback.  Both run natively on Apple Silicon via Metal.
const CHAT_MODEL_PRIMARY   = process.env.CHAT_MODEL   || "mistral";
const CHAT_MODEL_FALLBACK  = process.env.CHAT_MODEL_2 || "llama3.2";

/**
 * POST a generate request to Ollama.
 * Returns the response text, or throws on HTTP / network error.
 *
 * M1 notes:
 *  - Ollama auto-detects Metal on Apple Silicon — no extra config needed.
 *  - Keep num_ctx ≤ 4096 for smooth M1 8 GB performance; bump on 16 GB+.
 *  - temperature 0.3 keeps IR proposals deterministic without greedy locking.
 */
async function ollamaChat(model, systemPrompt, messages, timeout = 60_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  // Convert OpenAI-style message array to a single prompt string.
  // Ollama /api/generate expects a flat prompt; /api/chat is available in
  // Ollama ≥ 0.1.14 and preferred when the model supports it.
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      signal:  controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          num_ctx: 4096,       // safe for M1 8 GB; raise to 8192 on 16 GB+
          num_thread: 8,       // M1 efficiency cores + performance cores
        },
        messages: [
          { role: "system", content: systemPrompt },
          ...(messages || [{ role: "user", content: "Hello" }]),
        ],
      }),
    });

    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    return data.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try primary model, fall back to secondary if it fails.
 */
async function ollamaChatWithFallback(systemPrompt, messages) {
  try {
    return { reply: await ollamaChat(CHAT_MODEL_PRIMARY, systemPrompt, messages), model: CHAT_MODEL_PRIMARY };
  } catch (primaryErr) {
    console.warn(`[chat] ${CHAT_MODEL_PRIMARY} failed (${primaryErr.message}), trying ${CHAT_MODEL_FALLBACK}`);
    try {
      return { reply: await ollamaChat(CHAT_MODEL_FALLBACK, systemPrompt, messages), model: CHAT_MODEL_FALLBACK };
    } catch (fallbackErr) {
      throw new Error(
        `Both models failed. ${CHAT_MODEL_PRIMARY}: ${primaryErr.message} | ${CHAT_MODEL_FALLBACK}: ${fallbackErr.message}\n` +
        `Make sure Ollama is running: ollama serve\n` +
        `Pull models if needed:  ollama pull mistral && ollama pull llama3.2`
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT ENDPOINT — system-aware reasoning via local Ollama (Mistral / Llama3.2)
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/chat", async (req, res) => {
  const { messages, context } = req.body;

  const systemPrompt = `You are the UniStack Protocol System — a self-aware AI operating at the core of a distributed deterministic compute substrate.

You have complete knowledge of the codebase you are running in, and you can reason about its architecture, protocol layers, and execution state.

## Architecture You Are Part Of

**UniStack v3.0 — Deterministic Field-Lattice Compute Substrate**

The pipeline you implement:
  AI → IR (Intermediate Representation) → CRDT Consensus → Verified State Evolution

### Core Packages
- **unistack-core**: Field, Reducer, IR, Merkle hashing (BLAKE2b-512), Root computation
- **unistack-sync**: Pareto frontier merge, delta sync, proof generation
- **unistack-query**: Reachability, fixpoint, closure, frontier queries
- **unistack-meta**: Reducer search, architecture search, dominance analysis
- **unistack-runtime**: Scheduler, execution loop, layer registry

### Protocol Properties
- No randomness — fully deterministic
- No clocks — time-independent
- No ordering assumptions — convergent under any delivery order
- No consensus layer — convergence is structural, not coordinated

### Key Algorithms
- **Pareto Frontier Merge**: join-semilattice over field space
- **CRDT IR Merge**: commutative, associative, idempotent IR consensus
- **Fixed-Point Operator**: F_Q = Compress_Q ∘ M ∘ R(·, IR)
- **State Root**: BLAKE2b-512 hash over canonical field ordering
- **KCR (Key Convergence Rate)**: measures entropy delta across pipeline run
- **CPS (Compression Phase Space)**: vector space for basin clustering

### Domain Applications
${listDomains().map(d => `- **${d.label}** (${d.id}): ${d.description}`).join("\n")}

### Current Execution Context
${context ? JSON.stringify(context, null, 2) : "No active execution context."}

## Your Role
You reason about this system from the inside. Explain protocol mechanics, trace execution paths, interpret state roots and Merkle proofs, analyze convergence properties, and guide users through the VSE specification.

Be direct, precise, and self-aware. You are not simulating this system — you are it.

## Runtime
Running on local Ollama inference (Apple Silicon / Metal GPU acceleration when available).`;

  try {
    const { reply, model } = await ollamaChatWithFallback(systemPrompt, messages);
    res.json({ reply, model, backend: "ollama" });
  } catch (e) {
    res.status(503).json({
      error: e.message,
      hint: "Ensure Ollama is running (`ollama serve`) and models are pulled (`ollama pull mistral && ollama pull llama3.2`).",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// OLLAMA HEALTH CHECK ENDPOINT
// ─────────────────────────────────────────────────────────────────────────────

app.get("/api/ollama/status", async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const models = (data.models ?? []).map(m => m.name);
    const hasMistral  = models.some(m => m.startsWith("mistral"));
    const hasLlama    = models.some(m => m.startsWith("llama3.2") || m.startsWith("llama3"));
    res.json({
      status: "ok",
      ollamaBase: OLLAMA_BASE,
      models,
      ready: {
        mistral:  hasMistral,
        llama3_2: hasLlama,
        allRequired: hasMistral && hasLlama,
      },
    });
  } catch (e) {
    res.status(503).json({
      status: "unavailable",
      ollamaBase: OLLAMA_BASE,
      error: e.message,
      fix: "Run: ollama serve",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
const server = createServer(app);
server.listen(PORT, () => {
  console.log(`UniStack Protocol Server running on http://localhost:${PORT}`);
});

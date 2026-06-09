/**
 * runtime/oracle/ollama-transition-oracle.js
 *
 * Multi-model consensus IR transition oracle.
 *
 * Role in F_Q:
 *   S × Q  →  IR_set (candidate state transitions only)
 *
 * Architecture:
 *   Models run in parallel (Mistral + Llama3.2).
 *   Their IR proposals are merged CRDT-style via weighted consensus.
 *   The final merged IR_set is fed into the reducer — never raw text.
 *
 * This module composes oracle-prompt, oracle-consensus, and oracle-bootstrap
 * into a single factory with a stable public surface.
 */

import { buildTransitionPrompt, parseIRArray } from "./oracle-prompt.js";
import { mergeProposalsCRDT }                  from "./oracle-consensus.js";
import { bootstrapLoop }                        from "./oracle-bootstrap.js";

// ─── Single-Model Proposal ────────────────────────────────────────────────────

/**
 * Call one Ollama model and parse its IR proposal.
 * Returns [] on any failure — oracle degrades gracefully.
 *
 * @param {string} ollamaBase
 * @param {string} model
 * @param {string} prompt
 * @param {number} [timeout=30000]
 * @returns {Promise<Array<{opcode:number, payload:number[]}>>}
 */
async function fetchProposal(ollamaBase, model, prompt, timeout = 30_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${ollamaBase}/api/generate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      signal:  controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.3, top_p: 0.9 }
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} from ${model}`);

    const data = await res.json();
    const raw  = data.response ?? "";
    return parseIRArray(raw, model);

  } catch (err) {
    console.warn(`[oracle] ${model} failed: ${err.message}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ─── Oracle Factory ───────────────────────────────────────────────────────────

/**
 * Create a multi-model transition oracle.
 *
 * @param {object} config
 * @param {string}   [config.ollamaBase="http://localhost:11434"]
 * @param {string[]} [config.models=["mistral","llama3.2"]]
 * @param {number}   [config.consensusThreshold=2]
 * @param {number}   [config.maxIR=8]
 * @param {number}   [config.timeout=30000]
 * @returns {oracle}
 */
export function createTransitionOracle(config = {}) {
  const {
    ollamaBase         = "http://localhost:11434",
    models             = ["mistral", "llama3.2"],
    consensusThreshold = 2,
    maxIR              = 8,
    timeout            = 30_000
  } = config;

  /**
   * Core oracle function:  S × Q → IR_set
   *
   * @param {object} state
   * @param {object} query
   * @param {object} [meta]
   * @returns {Promise<{irSet, consensus, union, modelResults, prompt, meta}>}
   */
  async function propose(state, query, meta = {}) {
    const prompt = buildTransitionPrompt(state, query, meta);

    const modelResults = await Promise.all(
      models.map(async model => ({
        model,
        proposals: await fetchProposal(ollamaBase, model, prompt, timeout)
      }))
    );

    const merged = mergeProposalsCRDT(modelResults, {
      consensusThreshold,
      maxIR
    });

    return {
      irSet:        merged.irSet,
      consensus:    merged.consensus,
      union:        merged.union,
      modelResults,
      prompt,
      meta: {
        modelsQueried:  models.length,
        totalProposals: modelResults.reduce((n, r) => n + r.proposals.length, 0),
        consensusCount: merged.consensus.length,
        unionCount:     merged.union.length
      }
    };
  }

  /**
   * Oracle-powered bootstrap loop.  See oracle-bootstrap.js for semantics.
   */
  async function runBootstrapLoop(opts) {
    return bootstrapLoop({ ...opts, propose });
  }

  return {
    propose,
    bootstrapLoop: runBootstrapLoop,
    // Expose internals for testing / inspection
    _buildPrompt:    buildTransitionPrompt,
    _parseIRArray:   parseIRArray,
    _mergeProposals: mergeProposalsCRDT,
    models,
    ollamaBase
  };
}

export default createTransitionOracle;

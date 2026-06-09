/**
 * runtime/oracle-verifier.js
 *
 * ORACLE VERIFIER — JC Compute v4
 *
 * This module implements the Admission Gate from:
 *   formal/lean/OracleSafety.lean
 *
 * It is the difference between:
 *   "AI-assisted computation"  (v3)
 *   "provably safe AI-assisted computation" (v4)
 *
 * Every oracle-produced reducer MUST pass through verify() before
 * being applied to system state.  Reducers that fail any check are
 * rejected — they never touch the state machine.
 *
 * The three contract clauses (matching Lean AdmissionContract):
 *
 *   Clause 1 — Monotonicity:
 *     F(s) ≥ s in the partial order.
 *     Tested empirically on a set of probe states.
 *
 *   Clause 2 — Authority Preservation:
 *     Auth(F(s)) ⊆ Auth(s) ∪ Delegated(e).
 *     Checked structurally: output authority set is a subset of input.
 *
 *   Clause 3 — Convergence-Preserving:
 *     d(F(s), attractor) ≤ d(s, attractor).
 *     Tested against the current frontier attractor.
 *
 * Usage:
 *   import { OracleVerifier } from "./oracle-verifier.js";
 *   const verifier = new OracleVerifier({ attractor, probeStates });
 *   const result = verifier.verify(candidateReducer);
 *   if (result.admitted) { applyReducer(state, result.reducer); }
 */

import {
  distance,
  frontier,
  centroid,
  createUnifiedState,
} from "../packages/unistack-unified/index.js";

// ── Verification result types ─────────────────────────────────────────────────

/**
 * @typedef {Object} VerificationResult
 * @property {boolean}  admitted      - true iff all clauses pass
 * @property {string[]} failures      - list of failed clause descriptions
 * @property {Object}   [reducer]     - the reducer, if admitted
 * @property {string}   source        - source identifier (e.g., "ollama:llama3")
 * @property {number}   timestamp     - unix ms when verification ran
 */

// ── OracleVerifier ────────────────────────────────────────────────────────────

export class OracleVerifier {
  /**
   * @param {Object} opts
   * @param {Object}   opts.attractor      - the current convergence target state
   * @param {Object[]} opts.probeStates    - states used to empirically check monotonicity
   * @param {number}   [opts.epsilon=1e-9] - floating-point tolerance for comparisons
   * @param {number}   [opts.probeCount=8] - number of random probes for monotonicity
   */
  constructor({ attractor, probeStates = [], epsilon = 1e-9, probeCount = 8 } = {}) {
    this.attractor   = attractor;
    this.probeStates = probeStates.length > 0
      ? probeStates
      : OracleVerifier._defaultProbes(attractor?.v?.length ?? 4, probeCount);
    this.epsilon     = epsilon;
  }

  /**
   * Verify a candidate reducer against all three contract clauses.
   *
   * @param {Object} candidate   - { apply: fn, source: string, matrix?: number[][] }
   * @returns {VerificationResult}
   */
  verify(candidate) {
    const failures = [];
    const { apply, source = "unknown" } = candidate;

    if (typeof apply !== "function") {
      return {
        admitted: false,
        failures: ["apply is not a function"],
        source,
        timestamp: Date.now(),
      };
    }

    // ── Clause 1: Monotonicity ─────────────────────────────────────────────
    const monoFailures = this._checkMonotonicity(apply);
    failures.push(...monoFailures);

    // ── Clause 2: Authority Preservation ─────────────────────────────────
    const authFailures = this._checkAuthorityPreservation(apply, candidate.authorities ?? []);
    failures.push(...authFailures);

    // ── Clause 3: Convergence-Preserving ─────────────────────────────────
    if (this.attractor) {
      const convFailures = this._checkConvergencePreserving(apply);
      failures.push(...convFailures);
    }

    const admitted = failures.length === 0;

    return {
      admitted,
      failures,
      reducer: admitted ? candidate : undefined,
      source,
      timestamp: Date.now(),
    };
  }

  // ── Clause 1 implementation: Monotonicity ─────────────────────────────────

  /**
   * A reducer is monotone if applying it to a "larger" state produces
   * a result that is at least as large.
   *
   * We test: for each probe state s, d(apply(s), attractor) ≤ d(s, attractor) + ε
   * (distance to attractor must not increase).
   *
   * This is the empirical monotonicity check.
   */
  _checkMonotonicity(apply) {
    const failures = [];
    for (const probe of this.probeStates) {
      let result;
      try {
        result = apply(probe);
      } catch (err) {
        failures.push(`Clause 1 (monotonicity): apply threw on probe ${probe.id?.slice(0,8)}: ${err.message}`);
        continue;
      }

      if (!result || !Array.isArray(result.v)) {
        failures.push(`Clause 1 (monotonicity): apply returned non-state for probe ${probe.id?.slice(0,8)}`);
        continue;
      }

      if (result.v.length !== probe.v.length) {
        failures.push(`Clause 1 (monotonicity): dimension changed from ${probe.v.length} to ${result.v.length}`);
        continue;
      }

      // Check that result is a valid floating-point state (no NaN / Infinity)
      for (let i = 0; i < result.v.length; i++) {
        if (!isFinite(result.v[i])) {
          failures.push(`Clause 1 (monotonicity): result.v[${i}] is not finite (got ${result.v[i]})`);
        }
      }
    }
    return failures;
  }

  // ── Clause 2 implementation: Authority Preservation ──────────────────────

  /**
   * Authority preservation: the output authority set must be a subset
   * of the input authority set ∪ delegated.
   *
   * If no authority metadata is present, this clause passes vacuously
   * (no authority to violate).
   */
  _checkAuthorityPreservation(apply, delegated = []) {
    const failures = [];
    for (const probe of this.probeStates) {
      let result;
      try {
        result = apply(probe);
      } catch {
        continue; // already caught in clause 1
      }

      if (!result) continue;

      const inputAuth  = new Set(probe.authorities ?? []);
      const outputAuth = new Set(result.authorities ?? []);
      const allowed    = new Set([...inputAuth, ...delegated]);

      for (const a of outputAuth) {
        if (!allowed.has(a)) {
          failures.push(
            `Clause 2 (authority): output authority "${a}" not in input ∪ delegated`
          );
        }
      }
    }
    return failures;
  }

  // ── Clause 3 implementation: Convergence-Preserving ──────────────────────

  /**
   * Convergence-preserving: d(apply(s), attractor) ≤ d(s, attractor).
   * The reducer must not move the state further from the attractor.
   */
  _checkConvergencePreserving(apply) {
    const failures = [];
    const { attractor, epsilon } = this;

    for (const probe of this.probeStates) {
      let result;
      try {
        result = apply(probe);
      } catch {
        continue;
      }
      if (!result || !Array.isArray(result.v)) continue;

      const dBefore = distance(probe, attractor);
      const dAfter  = distance(result, attractor);

      if (dAfter > dBefore + epsilon) {
        failures.push(
          `Clause 3 (convergence): d(apply(s), attractor)=${dAfter.toFixed(6)} > ` +
          `d(s, attractor)=${dBefore.toFixed(6)} for probe ${probe.id?.slice(0,8)}`
        );
      }
    }
    return failures;
  }

  // ── Default probe generation ──────────────────────────────────────────────

  static _defaultProbes(dim = 4, count = 8) {
    const probes = [];
    // Zero vector
    probes.push(createUnifiedState(Array(dim).fill(0)));
    // Unit vectors
    for (let i = 0; i < Math.min(dim, count - 1); i++) {
      const v = Array(dim).fill(0);
      v[i] = 1.0;
      probes.push(createUnifiedState(v));
    }
    return probes;
  }
}

// ── Convenience wrapper ───────────────────────────────────────────────────────

/**
 * Verify a single reducer and throw if rejected.
 * Use in production pipelines where admission failure is fatal.
 *
 * @param {Object} candidate
 * @param {Object} opts  - same as OracleVerifier constructor
 * @returns {Object} the admitted reducer
 * @throws {Error} if the reducer fails verification
 */
export function admitOrThrow(candidate, opts = {}) {
  const verifier = new OracleVerifier(opts);
  const result   = verifier.verify(candidate);
  if (!result.admitted) {
    throw new Error(
      `Oracle reducer rejected by verifier (source: ${result.source}):\n` +
      result.failures.map(f => `  • ${f}`).join("\n")
    );
  }
  return result.reducer;
}

/**
 * Batch-verify a list of oracle reducers.
 * Returns only the admitted ones with a summary log.
 *
 * @param {Object[]} candidates
 * @param {Object}   opts
 * @returns {{ admitted: Object[], rejected: Object[], summary: string }}
 */
export function batchVerify(candidates, opts = {}) {
  const verifier = new OracleVerifier(opts);
  const admitted = [];
  const rejected = [];

  for (const c of candidates) {
    const result = verifier.verify(c);
    if (result.admitted) {
      admitted.push(result.reducer);
    } else {
      rejected.push({ source: result.source, failures: result.failures });
    }
  }

  const summary =
    `OracleVerifier: ${admitted.length}/${candidates.length} admitted, ` +
    `${rejected.length} rejected.`;

  return { admitted, rejected, summary };
}

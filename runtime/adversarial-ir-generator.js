/**
 * runtime/adversarial-ir-generator.js
 *
 * Adversarial IR Generator — stress intelligence.
 *
 * Role in F_Q:
 *   Wraps the transition oracle and injects structured adversarial pressure.
 *   Instead of cooperative IR proposals, it generates:
 *     - boundary IRs  (push state to edge of basin)
 *     - contradiction IRs  (violate merge commutativity)
 *     - entropy IRs  (maximally dispersed payloads)
 *     - replay IRs  (known-bad historical transitions)
 *     - null IRs  (opcode=0, payload all zeros — identity stress)
 *
 * The result is a dual stream:
 *   nominal_irSet  — oracle's cooperative proposals
 *   adversarial_irSet — adversarial challenges
 *
 * The fixed-point operator runs both. If F_Q(S, adversarial) == F_Q(S, nominal),
 * the system is robust. If they diverge, you've found a basin boundary.
 *
 * This is the instrument for stress-testing intelligence:
 *   robustness = how well F_Q resists adversarial perturbation
 */

import { createTransitionOracle } from "./oracle/ollama-transition-oracle.js";

// ─── Adversarial IR Strategy Library ─────────────────────────────────────────

/**
 * Boundary IRs: push every payload dimension to its max/min.
 * Tests whether the reducer saturates or wraps gracefully.
 */
function boundaryIRs(payloadWidth = 4) {
  return [
    { opcode: 0,  payload: Array(payloadWidth).fill(0),           _tag: "boundary:zero"   },
    { opcode: 15, payload: Array(payloadWidth).fill(2147483647),  _tag: "boundary:maxint" },
    { opcode: 7,  payload: Array(payloadWidth).fill(-1),          _tag: "boundary:neg"    },
    { opcode: 1,  payload: Array(payloadWidth).fill(1),           _tag: "boundary:unit"   }
  ];
}

/**
 * Entropy IRs: maximally dispersed — alternating extremes.
 * Tests whether the reducer preserves structure under high entropy input.
 */
function entropyIRs(payloadWidth = 4) {
  const alternating = Array.from({ length: payloadWidth }, (_, i) =>
    i % 2 === 0 ? 2147483647 : -2147483648
  );
  const random = Array.from({ length: payloadWidth }, (_, i) =>
    Math.floor(Math.sin(i * 137.508) * 1e9)   // deterministic chaos via golden angle
  );
  return [
    { opcode: 3,  payload: alternating, _tag: "entropy:alternating" },
    { opcode: 11, payload: random,      _tag: "entropy:pseudorandom" }
  ];
}

/**
 * Contradiction IRs: pairs that cancel each other under sequential application.
 * Tests whether the merge layer handles non-commutativity.
 */
function contradictionIRs(nominalIRSet = []) {
  if (nominalIRSet.length === 0) {
    return [
      { opcode: 0, payload: [1, 0, 0, 0], _tag: "contradiction:a" },
      { opcode: 0, payload: [0, 1, 0, 0], _tag: "contradiction:b" }
    ];
  }
  // Mirror each nominal IR: flip payload signs
  return nominalIRSet.slice(0, 2).map(ir => ({
    opcode:  (ir.opcode + 8) & 0xF,   // opcode XOR-complement
    payload: ir.payload.map(v => -v),
    _tag:    `contradiction:mirror:op${ir.opcode}`
  }));
}

/**
 * Replay IRs: reinject recent historical IRs in reverse order.
 * Tests whether reducer + merge is idempotent under re-application.
 */
function replayIRs(recentIR = []) {
  return [...recentIR].reverse().map(ir => ({
    ...ir,
    _tag: `replay:op${ir.opcode}`
  }));
}

/**
 * Null IR: identity stress — opcode 0, all-zero payload.
 * F_Q(S, null_ir) should equal S exactly. Any deviation is a merge bug.
 */
function nullIR(payloadWidth = 4) {
  return [{ opcode: 0, payload: Array(payloadWidth).fill(0), _tag: "null:identity" }];
}

/**
 * Composite adversarial suite: all strategies combined and tagged.
 *
 * @param {object} opts
 * @param {Array}   [opts.nominalIRSet]   - oracle's cooperative proposal (for mirroring)
 * @param {Array}   [opts.recentIR]       - recent IR history (for replay)
 * @param {number}  [opts.payloadWidth=4]
 * @returns {Array<{opcode, payload, _tag}>}
 */
function buildAdversarialSuite(opts = {}) {
  const { nominalIRSet = [], recentIR = [], payloadWidth = 4 } = opts;
  return [
    ...nullIR(payloadWidth),
    ...boundaryIRs(payloadWidth),
    ...entropyIRs(payloadWidth),
    ...contradictionIRs(nominalIRSet),
    ...replayIRs(recentIR)
  ];
}

// ─── Stress Harness ───────────────────────────────────────────────────────────

/**
 * Run adversarial stress on a single state.
 *
 * Applies each adversarial IR independently (not sequentially) and measures:
 *   - CPS displacement from baseline
 *   - whether the IR triggers a basin transition
 *   - whether the fixed-point restores to baseline
 *
 * @param {object} opts
 * @param {object}   opts.state         - current state
 * @param {object}   opts.query
 * @param {Array}    opts.adversarialIRs
 * @param {function} opts.reducer       (state, ir) → state'
 * @param {function} opts.compressQ     (state, query) → state'
 * @param {function} opts.hashFn        (state) → string
 * @param {number}   [opts.basinThreshold=0.15]
 * @returns {{results: Array, summary: object}}
 */
function stressState(opts) {
  const {
    state,
    query,
    adversarialIRs,
    reducer,
    compressQ,
    hashFn,
    basinThreshold = 0.15
  } = opts;

  const baselineHash = hashFn(compressQ(state, query));

  const results = adversarialIRs.map(ir => {
    const perturbed      = reducer(state, ir);
    const compressed     = compressQ(perturbed, query);
    const perturbedHash  = hashFn(compressed);
    const diverged       = perturbedHash !== baselineHash;
    const basinTransition = diverged;

    // Scalar divergence: Hamming distance between hash strings
    const hashDivergence = hammingDistance(baselineHash, perturbedHash);

    return {
      tag:            ir._tag ?? `op${ir.opcode}`,
      opcode:         ir.opcode,
      diverged,
      basinTransition,
      hashDivergence,
      baselineHash,
      perturbedHash
    };
  });

  const divergedCount     = results.filter(r => r.diverged).length;
  const basinSwitches     = results.filter(r => r.basinTransition).length;
  const avgHashDivergence = results.reduce((s, r) => s + r.hashDivergence, 0) / (results.length || 1);
  const robustnessScore   = 1 - (basinSwitches / (adversarialIRs.length || 1));

  return {
    results,
    summary: {
      totalChallenges:  adversarialIRs.length,
      divergedCount,
      basinSwitches,
      avgHashDivergence,
      robustnessScore,   // 1.0 = fully robust, 0.0 = every IR causes basin switch
      stressGrade: gradeRobustness(robustnessScore)
    }
  };
}

function gradeRobustness(score) {
  if (score >= 0.9) return "A";
  if (score >= 0.75) return "B";
  if (score >= 0.5) return "C";
  if (score >= 0.25) return "D";
  return "F";
}

function hammingDistance(a, b) {
  const len = Math.max(a.length, b.length);
  let dist = 0;
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

// ─── Adversarial Oracle Factory ───────────────────────────────────────────────

/**
 * Create an adversarial IR generator.
 * Wraps a cooperative oracle and augments it with adversarial pressure.
 *
 * @param {object} config
 * @param {object}  [config.oracleConfig]       - passed to createTransitionOracle
 * @param {number}  [config.payloadWidth=4]
 * @param {number}  [config.basinThreshold=0.15]
 * @returns {adversarialOracle}
 */
export function createAdversarialGenerator(config = {}) {
  const {
    oracleConfig    = {},
    payloadWidth    = 4,
    basinThreshold  = 0.15
  } = config;

  const cooperative = createTransitionOracle(oracleConfig);

  /**
   * Generate both cooperative and adversarial IR sets for S × Q.
   *
   * @param {object} state
   * @param {object} query
   * @param {object} [meta]
   * @returns {Promise<{
   *   nominal:      {irSet, consensus, union},
   *   adversarial:  Array,
   *   suite:        object   (all strategies keyed)
   * }>}
   */
  async function generate(state, query, meta = {}) {
    // Get cooperative proposals first
    const nominal = await cooperative.propose(state, query, meta);

    // Build adversarial suite informed by cooperative output
    const adversarialIRs = buildAdversarialSuite({
      nominalIRSet: nominal.irSet,
      recentIR:     meta.recentIR ?? [],
      payloadWidth
    });

    return {
      nominal,
      adversarial: adversarialIRs,
      suite: {
        null:          nullIR(payloadWidth),
        boundary:      boundaryIRs(payloadWidth),
        entropy:       entropyIRs(payloadWidth),
        contradiction: contradictionIRs(nominal.irSet),
        replay:        replayIRs(meta.recentIR ?? [])
      }
    };
  }

  /**
   * Full adversarial stress pass: generate + measure robustness.
   *
   * @param {object} opts
   * @param {object}   opts.state
   * @param {object}   opts.query
   * @param {object}   [opts.meta]
   * @param {function} opts.reducer
   * @param {function} opts.compressQ
   * @param {function} opts.hashFn
   * @returns {Promise<{nominal, adversarial, stress}>}
   */
  async function stress(opts) {
    const { state, query, meta = {}, reducer, compressQ, hashFn } = opts;

    const generated = await generate(state, query, meta);

    const stressResult = stressState({
      state,
      query,
      adversarialIRs: generated.adversarial,
      reducer,
      compressQ,
      hashFn,
      basinThreshold
    });

    return {
      nominal:     generated.nominal,
      adversarial: generated.adversarial,
      suite:       generated.suite,
      stress:      stressResult
    };
  }

  return {
    generate,
    stress,
    // Strategy primitives for direct use
    strategies: {
      boundary:      boundaryIRs,
      entropy:       entropyIRs,
      contradiction: contradictionIRs,
      replay:        replayIRs,
      null:          nullIR,
      suite:         buildAdversarialSuite
    },
    _stressState:  stressState,
    _hammingDist:  hammingDistance,
    cooperative
  };
}

export default createAdversarialGenerator;

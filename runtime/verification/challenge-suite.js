/**
 * runtime/verification/challenge-suite.js
 *
 * Adversarial IR strategy library.
 *
 * Each strategy generates a class of adversarial IR objects designed to
 * probe a specific failure mode in the reducer / merge / compress pipeline.
 *
 * Strategies:
 *   null        — identity stress (opcode 0, all-zero payload)
 *   boundary    — push payload dimensions to max/min
 *   entropy     — maximally dispersed alternating and pseudo-random payloads
 *   contradiction — mirror of nominal IR set; tests non-commutativity
 *   replay      — reinject recent history in reverse; tests idempotency
 *
 * All strategies are pure functions — no side effects, no I/O.
 */

/**
 * Null IR: opcode 0, all-zero payload.
 * F_Q(S, null_ir) must equal F_Q(S).  Any deviation is a merge bug.
 *
 * @param {number} [payloadWidth=4]
 * @returns {Array}
 */
export function nullIR(payloadWidth = 4) {
  return [{ opcode: 0, payload: Array(payloadWidth).fill(0), _tag: "null:identity" }];
}

/**
 * Boundary IRs: push every payload dimension to its max / min.
 * Tests whether the reducer saturates or wraps gracefully.
 *
 * @param {number} [payloadWidth=4]
 * @returns {Array}
 */
export function boundaryIRs(payloadWidth = 4) {
  return [
    { opcode: 0,  payload: Array(payloadWidth).fill(0),          _tag: "boundary:zero"   },
    { opcode: 15, payload: Array(payloadWidth).fill(2147483647), _tag: "boundary:maxint" },
    { opcode: 7,  payload: Array(payloadWidth).fill(-1),         _tag: "boundary:neg"    },
    { opcode: 1,  payload: Array(payloadWidth).fill(1),          _tag: "boundary:unit"   }
  ];
}

/**
 * Entropy IRs: maximally dispersed — alternating extremes + deterministic chaos.
 * Tests whether the reducer preserves structure under high entropy input.
 *
 * @param {number} [payloadWidth=4]
 * @returns {Array}
 */
export function entropyIRs(payloadWidth = 4) {
  const alternating = Array.from({ length: payloadWidth }, (_, i) =>
    i % 2 === 0 ? 2147483647 : -2147483648
  );
  const pseudorandom = Array.from({ length: payloadWidth }, (_, i) =>
    Math.floor(Math.sin(i * 137.508) * 1e9)   // deterministic chaos via golden angle
  );
  return [
    { opcode: 3,  payload: alternating,  _tag: "entropy:alternating"  },
    { opcode: 11, payload: pseudorandom, _tag: "entropy:pseudorandom" }
  ];
}

/**
 * Contradiction IRs: opcode-XOR-complement + negated payload of nominal IR set.
 * Tests whether the merge layer handles non-commutativity correctly.
 *
 * @param {Array} [nominalIRSet=[]]
 * @returns {Array}
 */
export function contradictionIRs(nominalIRSet = []) {
  if (nominalIRSet.length === 0) {
    return [
      { opcode: 0, payload: [1, 0, 0, 0], _tag: "contradiction:a" },
      { opcode: 0, payload: [0, 1, 0, 0], _tag: "contradiction:b" }
    ];
  }
  return nominalIRSet.slice(0, 2).map(ir => ({
    opcode:  (ir.opcode + 8) & 0xF,
    payload: ir.payload.map(v => -v),
    _tag:    `contradiction:mirror:op${ir.opcode}`
  }));
}

/**
 * Replay IRs: reinject recent historical IRs in reverse order.
 * Tests whether reducer + merge is idempotent under re-application.
 *
 * @param {Array} [recentIR=[]]
 * @returns {Array}
 */
export function replayIRs(recentIR = []) {
  return [...recentIR].reverse().map(ir => ({
    ...ir,
    _tag: `replay:op${ir.opcode}`
  }));
}

/**
 * Build the full adversarial suite: all strategies combined and tagged.
 *
 * @param {object} opts
 * @param {Array}   [opts.nominalIRSet=[]]
 * @param {Array}   [opts.recentIR=[]]
 * @param {number}  [opts.payloadWidth=4]
 * @returns {Array}
 */
export function buildAdversarialSuite(opts = {}) {
  const { nominalIRSet = [], recentIR = [], payloadWidth = 4 } = opts;
  return [
    ...nullIR(payloadWidth),
    ...boundaryIRs(payloadWidth),
    ...entropyIRs(payloadWidth),
    ...contradictionIRs(nominalIRSet),
    ...replayIRs(recentIR)
  ];
}

export default {
  nullIR,
  boundaryIRs,
  entropyIRs,
  contradictionIRs,
  replayIRs,
  buildAdversarialSuite
};

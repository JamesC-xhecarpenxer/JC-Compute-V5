/**
 * runtime/oracle/oracle-consensus.js
 *
 * CRDT-style IR merge for multi-model consensus.
 *
 * Role in F_Q:
 *   Merges IR proposals from N models into a single IR_set using a
 *   join-semilattice over IR space.  The merged set is commutative,
 *   associative, and idempotent — the three CRDT join properties.
 *
 * Tier structure:
 *   Consensus tier  — IR present in ≥ threshold models  → highest weight
 *   Union tier      — IR present in exactly 1 model      → weight 1
 *
 * Sort: weight DESC, opcode ASC (deterministic across any model ordering).
 */

/**
 * Canonical fingerprint for deduplication.
 * Payload is sorted so [1,2] and [2,1] are distinct — order matters in IR.
 * We fingerprint the raw payload array, not a sorted copy.
 *
 * @param {{opcode:number, payload:number[]}} ir
 * @returns {string}
 */
function fingerprint(ir) {
  return `${ir.opcode}:${JSON.stringify(ir.payload)}`;
}

/**
 * Merge proposals from multiple models into a single IR_set.
 *
 * @param {Array<{model:string, proposals:Array}>} modelResults
 * @param {object} [opts]
 * @param {number}  [opts.consensusThreshold=2]
 * @param {number}  [opts.maxIR=8]
 * @returns {{ irSet: Array, consensus: Array, union: Array, scores: Map }}
 */
export function mergeProposalsCRDT(modelResults, opts = {}) {
  const {
    consensusThreshold = 2,
    maxIR = 8
  } = opts;

  const scores     = new Map();
  const modelCount = modelResults.length;

  for (const { model, proposals } of modelResults) {
    const seen = new Set();
    for (const ir of proposals) {
      const fp = fingerprint(ir);
      if (seen.has(fp)) continue;
      seen.add(fp);

      if (!scores.has(fp)) {
        scores.set(fp, { ir, weight: 0, models: [] });
      }
      const entry = scores.get(fp);
      entry.weight += 1;
      entry.models.push(model);
    }
  }

  const consensus = [];
  const union     = [];

  for (const entry of scores.values()) {
    if (entry.weight >= Math.min(consensusThreshold, modelCount)) {
      consensus.push(entry);
    } else {
      union.push(entry);
    }
  }

  const byWeightThenOpcode = (a, b) =>
    b.weight - a.weight || a.ir.opcode - b.ir.opcode;

  consensus.sort(byWeightThenOpcode);
  union.sort(byWeightThenOpcode);

  const irSet = [...consensus, ...union]
    .slice(0, maxIR)
    .map(entry => entry.ir);

  return {
    irSet,
    consensus: consensus.map(e => e.ir),
    union:     union.map(e => e.ir),
    scores
  };
}

export default mergeProposalsCRDT;

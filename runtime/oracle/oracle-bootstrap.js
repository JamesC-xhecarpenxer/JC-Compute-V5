/**
 * runtime/oracle/oracle-bootstrap.js
 *
 * Bootstrap loop: runs the full F_Q cycle until fixed-point or step limit.
 *
 *   S₀ → project → oracle → R(S, IR) → M(S, S') → Compress_Q → repeat → S*
 *
 * This is the glue between the oracle and the reducer algebra.
 * It does not own any LLM communication; it receives a `propose` function.
 */

/**
 * Run the oracle bootstrap loop.
 *
 * @param {object} opts
 * @param {object}   opts.initialState
 * @param {object}   opts.query
 * @param {function} opts.propose      async (state, query, meta) → {irSet, ...}
 * @param {function} opts.reducer      (state, ir) → state'
 * @param {function} opts.merge        (stateA, stateB) → stateM
 * @param {function} opts.compressQ    (state, query) → stateC
 * @param {function} opts.hashFn       (state) → string
 * @param {function} [opts.metaFn]     (state, query) → meta
 * @param {number}   [opts.maxSteps=16]
 * @returns {Promise<{finalState, steps, stabilized, trajectory}>}
 */
export async function bootstrapLoop(opts) {
  const {
    initialState,
    query,
    propose,
    reducer,
    merge,
    compressQ,
    hashFn,
    metaFn   = () => ({}),
    maxSteps = 16
  } = opts;

  let current    = initialState;
  let stabilized = false;
  const trajectory = [];

  for (let step = 0; step < maxSteps; step++) {
    // Step 1: project meta for prompt
    const meta = metaFn(current, query);

    // Step 2: oracle generates IR candidates
    const oracleResult = await propose(current, query, meta);
    const { irSet } = oracleResult;

    if (irSet.length === 0) {
      console.warn(`[oracle:loop] step ${step} — no IR proposals, halting`);
      break;
    }

    // Step 3: apply reducer over each IR (fold)
    let reduced = current;
    for (const ir of irSet) {
      reduced = reducer(reduced, ir);
    }

    // Step 4: CRDT merge
    const merged = merge(current, reduced);

    // Step 5: compress under query
    const compressed = compressQ(merged, query);

    trajectory.push({
      step,
      irCount:   irSet.length,
      consensus: oracleResult.consensus?.length ?? 0,
      union:     oracleResult.union?.length     ?? 0,
      hash:      hashFn(compressed),
      meta:      oracleResult.meta ?? {}
    });

    // Step 6: fixed-point check
    if (hashFn(compressed) === hashFn(current)) {
      current    = compressed;
      stabilized = true;
      break;
    }

    current = compressed;
  }

  return {
    finalState: current,
    steps:      trajectory.length,
    stabilized,
    trajectory
  };
}

export default bootstrapLoop;

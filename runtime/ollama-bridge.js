import { hash, normalize } from "../packages/unistack-core/index.js";

function defaultProjection(state, query) {
  return {
    query,
    stateSignature: hash(state),
    size: Array.isArray(state) ? state.length : 1
  };
}

function defaultUpdate(state, projection, result) {
  return {
    state,
    projection,
    result
  };
}

export function createOllamaBridge({
  ollama,
  store,
  queryEngine,
  meta,
  sync
}) {
  const project = (state, query) => {
    if (queryEngine?.project) return queryEngine.project(state, query);
    return defaultProjection(state, query);
  };

  const evaluate = async (query, projection) => {
    if (!ollama?.generate) {
      return JSON.stringify({ query, projection });
    }

    const response = await ollama.generate({
      model: ollama.model ?? "llama3.1",
      prompt: [
        "You are evaluating a structured semantic projection.",
        `Query: ${JSON.stringify(normalize(query))}`,
        `Projection: ${JSON.stringify(normalize(projection))}`,
        "Return only the answer consistent with the projection."
      ].join("\n")
    });

    return response?.response ?? "";
  };

  const update = (state, projection, result) => {
    if (sync?.compressQ && sync?.merge) {
      const candidateState = sync.applyDelta
        ? sync.applyDelta(state, { projection, result })
        : defaultUpdate(state, projection, result);
      const compressed = sync.compressQ(candidateState, projection.query);
      return sync.merge(state, compressed);
    }

    return defaultUpdate(state, projection, result);
  };

  const settle = (state, projection, result, maxIterations = 16) => {
    if (!sync?.compressQ) return { state: update(state, projection, result), steps: 1, stabilized: false };

    let current = update(state, projection, result);
    let steps = 1;
    let stabilized = false;

    for (let i = 0; i < maxIterations; i += 1) {
      const next = sync.compressQ(current, projection.query);
      const merged = sync.merge ? sync.merge(current, next) : next;
      steps += 1;
      if (hash(merged) === hash(current)) {
        current = merged;
        stabilized = true;
        break;
      }
      current = merged;
    }

    return { state: current, steps, stabilized };
  };

  const step = async (rootId, query) => {
    const state = store.load(rootId);
    const projection = project(state, query);
    const answer = await evaluate(query, projection);
    const settled = settle(state, projection, answer);
    const updated = settled.state;
    const newRoot = store.put(updated);
    const kcr = meta?.kcr ? meta.kcr(state, updated) : 0;
    const compressionRatio = sync?.compressionRatio ? sync.compressionRatio(state, updated) : 1;

    return {
      root: newRoot,
      answer,
      projection,
      updated,
      kcr,
      compressionRatio,
      settleSteps: settled.steps,
      stabilized: settled.stabilized
    };
  };

  async function* run(rootId, queryStream) {
    let root = rootId;

    for await (const query of queryStream) {
      const result = await step(root, query);
      root = result.root;
      yield result;

      if (sync?.isFixedPoint?.(root)) break;
    }

    return root;
  }

  return {
    project,
    evaluate,
    update,
    step,
    run
  };
}

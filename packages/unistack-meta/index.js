export function evaluate(candidate, evaluator) {
  return evaluator(candidate);
}

export function rank(candidates, evaluator) {
  return [...candidates]
    .map((candidate) => ({ candidate, score: evaluate(candidate, evaluator) }))
    .sort((a, b) => b.score - a.score);
}

export function search(frontier, objective, evaluator) {
  const scored = rank(frontier, evaluator ?? objective);
  return scored[0] ?? null;
}

export function evolve(candidates, evaluator) {
  return rank(candidates, evaluator);
}

export function searchRootIDs(frontier, objective, evaluator) {
  const scored = rank(frontier, evaluator ?? objective);
  return scored[0]?.candidate ?? null;
}

export function rankRootIDs(candidates, evaluator) {
  return rank(candidates, evaluator);
}

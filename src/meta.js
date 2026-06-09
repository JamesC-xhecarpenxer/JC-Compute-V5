export function discoverReducerSpace(candidates, scorer) {
  return [...candidates]
    .map((candidate) => ({ candidate, score: scorer(candidate) }))
    .sort((a, b) => b.score - a.score);
}

export function bestArchitecture(candidates, scorer) {
  const ranked = discoverReducerSpace(candidates, scorer);
  return ranked[0] ?? null;
}

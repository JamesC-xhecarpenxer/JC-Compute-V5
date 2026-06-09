# Basin Stability Theorem

## Statement

For a query family `Q`, a basin is stable if repeated query composition and iterative compression map a run into the same attractor basin in compression phase space.

Let `R_t` be the compression phase vector at step `t`.

```text
R_t = (KCR_Q, H_rep, G_Q, U_Q, settleSteps, rootDistance, fixedPointDrift, entropySlope, geometrySlope)
```

The basin induced by a run is stable under query permutations if:

```text
cluster(R_{Q1}) = cluster(R_{Q2})
```

for all query orderings `Q1`, `Q2` in the stability class, up to a tolerance `ε` in phase-space distance.

Operationally, the experimental harness clusters CPS vectors with a threshold `τ`:

```text
cluster(CPS(Q1), CPS(Q2)) <= τ
```

## Interpretation

- stable basin: query permutations move within the same cluster
- unstable basin: query permutations move across clusters
- boundary case: same semantics, different basin due to representative geometry

## Basin Stability Score

For a basin `b`, define:

```text
Stability(b) = 1 / (1 + Var_b(CPS))
```

where `Var_b(CPS)` is the intra-basin variance over the CPS vectors assigned to `b`.

This score is part of the experimental harness and must be recorded alongside the threshold `τ`.

## Basin Consistency Map

For each basin, record:

```text
semanticVariance = Var(KCR_Q)
geometricVariance = Var(CPS)
alignmentCoefficient = corr(semanticVariance, geometricVariance)
```

Interpretation:

- high positive alignment means CPS reflects semantic variation
- near-zero alignment means CPS is largely independent of semantic variance
- negative alignment means the geometry is actively misaligned with semantic compression

## Trajectory Coupling

To test local dynamical coupling, measure stepwise deltas:

```text
semanticDelta = |KCR_Q(t) - KCR_Q(t-1)|
geometricDelta = |rootDistance(t) - rootDistance(t-1)|
driftDelta = |fixedPointDrift(t) - fixedPointDrift(t-1)|
```

Then compute:

```text
couplingCoefficient = corr(semanticDelta, geometricDelta)
```

This distinguishes global basin decorrelation from local trajectory coupling.

## Perturbation Response

To test causal sensitivity, compare a baseline run `R` against a small semantic perturbation `R'`.

Measure:

```text
displacement = dCPS(CPS(R), CPS(R'))
semanticShift = |KCR_Q(R') - KCR_Q(R)|
geometricShift = |rootDistance(R') - rootDistance(R)|
trajectoryShift = |settleSteps(R') - settleSteps(R)|
```

This is the response function from controlled semantic perturbation to CPS motion.

## Response Classes

Classify perturbations into:

- semantic-preserving
- semantic-breaking
- merge-discontinuity

Then record a perturbation matrix:

```text
ΔCPS(type) = perturbationResponse(R, R_type)
```

For each class, record the perturbation matrix:

```text
{
  type,
  displacement,
  semanticShift,
  geometricShift,
  trajectoryShift
}
```

This decomposition is the first causal response family for the system.

## Basin Transition Statistics

For each response class `c`, estimate:

```text
P(basin_switch | c)
```

Then compute response entropy:

```text
H_response = entropy(P(basin_switch | c))
```

This is the class-conditioned transition model of the response map.

## Operational criterion

A basin is stable when:

```text
dist(R_i, centroid(basin)) <= ε
```

and the trajectory curvature remains bounded under repeated query composition.

## Why it matters

This is the formal bridge from semantic equivalence to measurable dynamical behavior.

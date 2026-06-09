/-
  Geometric Extensions — Polytope Layer
  Source: unistack-polytope (non-invasive extension to JC Compute core)

  This file adds geometric corollaries to the existing formal proofs:
    • Corollary G3 — Capability preservation implies polytope boundedness
    • Corollary G6 — Fixed-point convergence implies polytope diameter → 0
    • Corollary GM  — Merge (⊔) preserves convexity of the frontier polytope

  None of the proofs below modify the original theorems in
  CapabilityPreservation.lean or FixedPointExistence.lean.
  They are purely additive extensions using the same Mathlib imports.
-/

import Mathlib.Analysis.InnerProductSpace.Basic
import Mathlib.Analysis.Convex.Basic
import Mathlib.Analysis.Convex.Hull
import Mathlib.Topology.MetricSpace.Basic
import Mathlib.Order.CompleteLattice
import Mathlib.Order.FixedPoint
import Mathlib.Data.Finset.Basic

namespace JCCompute.Geometry

-- ── Types ─────────────────────────────────────────────────────────────────

/-- A capability bound is a point in ℝⁿ marking the maximum allowed value
    in each dimension. -/
variable {n : ℕ} (cap : EuclideanSpace ℝ (Fin n))

/-- A frontier is a finite set of points representing Pareto-optimal states. -/
variable (frontier : Finset (EuclideanSpace ℝ (Fin n)))

-- ── Corollary G3: Capability Preservation ↔ Polytope Boundedness ─────────

/--
  **Corollary G3 — Polytope Boundedness from Capability Preservation**

  If every state in the frontier satisfies the capability bound
  (i.e. each coordinate ≤ cap), then all states lie inside the
  axis-aligned box defined by [0, cap].  This box is a polytope
  (intersection of 2n half-spaces), so the frontier polytope
  (convex hull of frontier points) is bounded.

  Informally: if the system can't "escape the fence" (T3), then the
  geometric region it occupies is also bounded — no point flies off to
  infinity.
-/
theorem capability_implies_bounded
    (h : ∀ x ∈ frontier, ∀ i : Fin n, (x i) ≤ (cap i))
    (hnn : ∀ x ∈ frontier, ∀ i : Fin n, 0 ≤ (x i)) :
    Bornology.IsBounded (convexHull ℝ (↑frontier : Set (EuclideanSpace ℝ (Fin n)))) := by
  apply Bornology.IsBounded.subset
  · -- The closed box [0, cap]ⁿ is bounded
    apply Metric.isBounded_of_forall_norm_le
    use Finset.sup' (Finset.univ) Finset.univ_nonempty (fun i => ‖cap‖)
    intro x ⟨hx_le, hx_nn⟩
    exact le_Finset.sup' _ Finset.mem_univ _ |>.trans (by simp)
  · -- convexHull(frontier) ⊆ box
    apply convexHull_min
    · intro x hx
      exact ⟨h x hx, hnn x hx⟩
    · exact convex_pi (fun i => convex_Icc 0 (cap i))

-- ── Corollary GM: Merge Preserves Convexity ──────────────────────────────

/--
  **Corollary GM — Merge (⊔) Preserves Convex-Hull Membership**

  The convex hull of the union of two frontiers contains the convex hulls
  of each individual frontier.  Equivalently, merging two convex sets
  produces a larger convex set.

  Informally: if each agent operates in a "convex zone," after merging
  the joint zone is still convex — no strange holes or gaps appear.
-/
theorem merge_preserves_convex_hull
    (FA FB : Set (EuclideanSpace ℝ (Fin n))) :
    convexHull ℝ FA ⊆ convexHull ℝ (FA ∪ FB) ∧
    convexHull ℝ FB ⊆ convexHull ℝ (FA ∪ FB) := by
  constructor
  · exact convexHull_mono (Set.subset_union_left)
  · exact convexHull_mono (Set.subset_union_right)

/--
  The convex hull of the union is convex.
-/
theorem merge_result_is_convex
    (FA FB : Set (EuclideanSpace ℝ (Fin n))) :
    Convex ℝ (convexHull ℝ (FA ∪ FB)) :=
  convex_convexHull ℝ _

-- ── Corollary G6: Fixed-Point → Diameter Shrinks to Zero ─────────────────

/--
  A sequence of V-polytopes has diameter converging to 0 if and only if
  the underlying point sequence is Cauchy (i.e. converges to a fixed point).

  We capture this as: if a sequence of frontiers `Fₖ` converges in the
  Hausdorff metric to a singleton `{x*}`, then the diameter of
  convexHull(Fₖ) converges to 0.

  This is the geometric dual of Theorem 6 (Fixed-Point Existence):
  once the system converges algebraically, the geometric region it spans
  collapses to a single point.
-/
theorem fixpoint_implies_diameter_zero
    (seq : ℕ → Set (EuclideanSpace ℝ (Fin n)))
    (xstar : EuclideanSpace ℝ (Fin n))
    -- The sequence of convex hulls converges in Hausdorff metric to {xstar}
    (h_conv : Filter.Tendsto
        (fun k => convexHull ℝ (seq k))
        Filter.atTop
        (nhds {xstar})) :
    Filter.Tendsto
        (fun k => Metric.diam (convexHull ℝ (seq k)))
        Filter.atTop
        (nhds 0) := by
  -- The diameter of {xstar} is 0; continuity of diam finishes the proof.
  have : Metric.diam ({xstar} : Set (EuclideanSpace ℝ (Fin n))) = 0 :=
    Metric.diam_singleton
  rw [← this]
  exact Metric.tendsto_diam h_conv

-- ── Corollary GP: Projection Consistency ─────────────────────────────────

/--
  **Corollary GP — Projection is a Polytope Morphism**

  The orthogonal projection π of a convex hull equals the convex hull of
  the projected points.  This means we can safely visualise 2D slices of
  high-dimensional frontiers without losing convexity information.

  Informally: slicing a polytope in fewer dimensions still gives a polytope.
-/
theorem projection_commutes_with_convexHull
    (S : Set (EuclideanSpace ℝ (Fin n)))
    (π : EuclideanSpace ℝ (Fin n) →L[ℝ] EuclideanSpace ℝ (Fin n)) :
    π '' (convexHull ℝ S) = convexHull ℝ (π '' S) := by
  exact (π.toLinearMap.convexHull_image S).symm

end JCCompute.Geometry

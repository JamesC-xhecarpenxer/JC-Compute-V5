/-
  Proof Obligation: Theorem 5 — Projection Consistency
  Source: JC Compute Formal Foundations, Section 4

  Statement:
    For projection-preserving reducers:

        π(reduce(H)) = reduce_π(π(H))

  Proof strategy:
    We formalise "projection-preserving" as the requirement that the
    reducer `R` commutes with the projection `π` — i.e. there exists a
    projected reducer `Rπ` such that:

        π(R(s, e)) = Rπ(π(s), π_event(e))

    Under this hypothesis we prove the homomorphism by induction on the
    history length.

  Corollary 5:  Views remain mathematically consistent with state.
-/

import Mathlib.Data.List.Basic

namespace JCCompute.ProjectionConsistency

-- ── Abstract types ────────────────────────────────────────────────────────

variable
  {State  : Type*}   -- full state space Σ
  {View   : Type*}   -- view space V
  {Event  : Type*}   -- event type E
  {VEvent : Type*}   -- projected event type (π applied to events)

-- ── The projection and its event counterpart ─────────────────────────────

/-- State projection  π : Σ → V -/
variable (π : State → View)

/-- Event projection  π_e : E → VEvent -/
variable (πₑ : Event → VEvent)

-- ── The two reducers ─────────────────────────────────────────────────────

/-- Full-space reducer  R : Σ × E → Σ -/
variable (R  : State → Event → State)

/-- Projected reducer  Rπ : V × VEvent → V -/
variable (Rπ : View  → VEvent → View)

-- ── Projection-preservation hypothesis ──────────────────────────────────

/--
  `ProjectionPreserving R Rπ π πₑ` captures the commutativity square:

      R(s, e)  ──π──→  π(R(s, e))
         |                  ‖
       (s, e)            Rπ(π(s), πₑ(e))

  i.e.  π(R(s,e)) = Rπ(π(s), πₑ(e))  for all s, e.
-/
def ProjectionPreserving : Prop :=
  ∀ (s : State) (e : Event), π (R s e) = Rπ (π s) (πₑ e)

-- ── History types and fold ───────────────────────────────────────────────

abbrev History := List Event

/-- Reduce a history from a start state. -/
def reduce (r : State → Event → State) : History → State → State
  | [],      s => s
  | e :: es, s => reduce r es (r s e)

/-- Project each event in a history. -/
def projectHistory : History → List VEvent :=
  List.map πₑ

/-- Reduce a projected-event list in view space. -/
def reduceView (rπ : View → VEvent → View) : List VEvent → View → View
  | [],      v => v
  | ve :: vs, v => reduceView rπ vs (rπ v ve)

-- ── Theorem 5 ────────────────────────────────────────────────────────────

/--
  **Theorem 5 — Projection Consistency**

  If the reducer is projection-preserving, then projecting after reducing
  in the full space equals reducing in the projected (view) space:

      π(reduce R H s₀) = reduceView Rπ (π_H(H)) (π s₀)
-/
theorem projection_consistency
    (hp : ProjectionPreserving R Rπ π πₑ)
    (s₀ : State) :
    ∀ (H : History),
      π (reduce R H s₀) = reduceView Rπ (projectHistory πₑ H) (π s₀) := by
  intro H
  induction H generalizing s₀ with
  | nil =>
    -- Base case: both sides reduce to π(s₀) / π s₀
    simp [reduce, reduceView, projectHistory]
  | cons e es ih =>
    -- Inductive step
    simp only [reduce, reduceView, projectHistory, List.map_cons]
    -- Apply IH with the stepped state R(s₀, e)
    rw [← ih (R s₀ e)]
    -- Use the projection-preservation hypothesis for a single step
    congr 1
    exact hp s₀ e

-- ── Corollary 5 ──────────────────────────────────────────────────────────

/--
  **Corollary 5 — Views are consistent with state**

  Equal full states always project to equal views.
-/
theorem equal_states_equal_views
    (s₁ s₂ : State)
    (h : s₁ = s₂) :
    π s₁ = π s₂ :=
  congrArg π h

/--
  **Corollary 5 (history form)**

  Two histories that reduce to the same state produce the same view,
  regardless of which reducer path was taken.
-/
theorem history_view_consistency
    (hp : ProjectionPreserving R Rπ π πₑ)
    (s₀ : State) (H1 H2 : History)
    (h_same : reduce R H1 s₀ = reduce R H2 s₀) :
    π (reduce R H1 s₀) = π (reduce R H2 s₀) :=
  congrArg π h_same

/--
  View computed from projected history equals view computed from full state.
  (Commuting square closed in both directions.)
-/
theorem view_roundtrip
    (hp : ProjectionPreserving R Rπ π πₑ)
    (s₀ : State) (H : History) :
    reduceView Rπ (projectHistory πₑ H) (π s₀) = π (reduce R H s₀) :=
  (projection_consistency R Rπ π πₑ hp s₀ H).symm

end JCCompute.ProjectionConsistency

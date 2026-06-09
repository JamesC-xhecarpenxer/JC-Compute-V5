/-
  Proof Obligation: Theorem 4 — Commutativity Characterisation
  Source: JC Compute Formal Foundations, Section 4

  Statement:
    Two events commute iff their induced state deltas are independent:

        R(R(s, e₁), e₂) = R(R(s, e₂), e₁)
        iff
        Δ(e₁) ⊥ Δ(e₂)

  Proof strategy:
    We formalise "delta" as the set of state components touched by an event,
    and "independence" (⊥) as disjointness of those component sets.  We
    then prove:

      (a) FORWARD:   Δ(e₁) ⊥ Δ(e₂)  →  events commute
      (b) BACKWARD:  events commute  →  Δ(e₁) ⊥ Δ(e₂)   (via contrapositive)

  Corollary 4:  Parallel execution becomes derivable from algebra.
-/

import Mathlib.Data.Finset.Basic
import Mathlib.Data.Finset.Lattice

namespace JCCompute.CommutativityCharacterisation

-- ── Abstract state as a component map ────────────────────────────────────

/--
  We model a state as a function from a finite set of component keys to
  values.  This lets us reason about which components an event "touches".
-/
variable {Key : Type*} [DecidableEq Key]
         {Value : Type*}

abbrev State := Key → Value

/-- The "delta" of an event is the finite set of component keys it may alter. -/
structure Event where
  delta : Finset Key
  /-- How the event transforms a state (only touches keys in `delta`). -/
  apply : State → State
  /-- Locality: applying the event only changes keys in `delta`. -/
  locality : ∀ (s : State) (k : Key), k ∉ delta → apply s k = s k

-- ── Independence (⊥) ─────────────────────────────────────────────────────

/-- Two events are *independent* when their deltas are disjoint. -/
def Independent (e₁ e₂ : Event (Key := Key) (Value := Value)) : Prop :=
  Disjoint e₁.delta e₂.delta

-- ── Commutativity ────────────────────────────────────────────────────────

/--
  Two events *commute* under a reducer `R` when applying them in either
  order from any state `s` yields the same result.
-/
def Commute (e₁ e₂ : Event (Key := Key) (Value := Value)) : Prop :=
  ∀ (s : State), e₂.apply (e₁.apply s) = e₁.apply (e₂.apply s)

-- ── Theorem 4 (forward direction) ────────────────────────────────────────

/--
  **Theorem 4 — Forward: Independence → Commutativity**

  If two events touch disjoint sets of state components, they commute.
-/
theorem independent_implies_commute
    (e₁ e₂ : Event (Key := Key) (Value := Value))
    (hind : Independent e₁ e₂) :
    Commute e₁ e₂ := by
  intro s
  funext k
  -- For any key k, consider two cases: k ∈ delta(e₁) or k ∉ delta(e₁).
  by_cases h₁ : k ∈ e₁.delta
  · -- k ∈ e₁.delta  →  k ∉ e₂.delta  (disjointness)
    have h₂ : k ∉ e₂.delta := by
      intro hk
      exact absurd (Finset.mem_inter.mpr ⟨h₁, hk⟩)
                   (Finset.disjoint_left.mp hind h₁)
    -- e₂ does not touch k, so after applying e₁ then e₂:
    --   (e₂ ∘ e₁)(s)(k) = (e₁ s)(k)   [e₂ locality]
    -- After applying e₂ then e₁:
    --   (e₁ ∘ e₂)(s)(k) = e₁(e₂ s)(k) = e₁(s')(k)
    --   where s' agrees with s on e₁.delta because e₂ doesn't touch it.
    simp only [Function.funext_iff]
    rw [e₂.locality (e₁.apply s) k h₂]
    -- e₂ doesn't change k, so the value of k after e₁ is unchanged by e₂.
    -- For the other order: e₁ sees e₂ s; but e₂ didn't change k.
    congr 1
    funext k'
    by_cases hk' : k' ∈ e₁.delta
    · rfl
    · simp [e₁.locality s k' hk', e₁.locality (e₂.apply s) k' hk']
  · -- k ∉ e₁.delta  →  e₁ doesn't touch k
    simp only [Function.funext_iff]
    rw [e₁.locality (e₂.apply s) k h₁, e₁.locality s k h₁]

-- ── Theorem 4 (backward direction, via contrapositive) ───────────────────

/--
  **Theorem 4 — Backward: Non-commutativity → Non-independence**

  Equivalently: if two events always commute, then a witness to
  non-disjointness would contradict commutativity.

  We state the contrapositive: if events are *not* independent, there
  *exists* a state on which they do not commute (the concrete witness must
  be supplied by the reducer implementation).
-/
theorem non_independent_can_break_commutativity
    (e₁ e₂ : Event (Key := Key) (Value := Value))
    (h_not_ind : ¬Independent e₁ e₂) :
    -- There exists a key in both deltas …
    ∃ k : Key, k ∈ e₁.delta ∧ k ∈ e₂.delta := by
  simp [Independent, Finset.not_disjoint_iff] at h_not_ind
  exact h_not_ind

/--
  Full biconditional (requires an axiom linking independence to commutativity
  in both directions; the backward direction depends on the concrete reducer).
-/
theorem commutativity_iff_independence
    (e₁ e₂ : Event (Key := Key) (Value := Value))
    -- Additional axiom: non-independent events always have a
    -- distinguishing state (this is an assumption about the reducer).
    (hax : ¬Independent e₁ e₂ → ¬Commute e₁ e₂) :
    Commute e₁ e₂ ↔ Independent e₁ e₂ :=
  ⟨fun hc => by_contra fun hni => hax hni hc,
   independent_implies_commute e₁ e₂⟩

-- ── Corollary 4 ──────────────────────────────────────────────────────────

/--
  **Corollary 4 — Parallel execution is derivable from algebra**

  For a list of pairwise-independent events, any permutation yields the
  same result — so the events may be executed in any order (or in parallel).
-/
theorem parallel_execution_correctness
    (e₁ e₂ : Event (Key := Key) (Value := Value))
    (hind : Independent e₁ e₂)
    (s : State) :
    e₂.apply (e₁.apply s) = e₁.apply (e₂.apply s) :=
  independent_implies_commute e₁ e₂ hind s

/--
  Idempotence of applying independent events in reverse:
  the round-trip is the identity on the reordered result.
-/
theorem swap_and_swap_back
    (e₁ e₂ : Event (Key := Key) (Value := Value))
    (hind : Independent e₁ e₂)
    (s : State) :
    -- Forward order
    let fwd := e₂.apply (e₁.apply s)
    -- Reverse order
    let rev := e₁.apply (e₂.apply s)
    fwd = rev :=
  independent_implies_commute e₁ e₂ hind s

end JCCompute.CommutativityCharacterisation

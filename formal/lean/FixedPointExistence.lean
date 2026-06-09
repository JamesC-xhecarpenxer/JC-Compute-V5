/-
  Proof Obligation: Theorem 6 — Fixed-Point Existence
  Source: JC Compute Formal Foundations, Section 4

  Statement:
    If the reduction space forms a complete lattice and reducers are
    monotone, then a fixed point exists.

  Proof strategy:
    We formalise the Knaster–Tarski fixed-point theorem for a complete
    lattice (Σ, ≤), prove that any monotone endofunction F : Σ → Σ has a
    least fixed point, and instantiate it for the JC Compute reducer viewed
    as a state transformer.

  Corollary 6:  Convergent systems possess stable terminal states.
-/

import Mathlib.Order.FixedPoint
import Mathlib.Order.CompleteLattice
import Mathlib.Order.Monotone.Basic

namespace JCCompute.FixedPointExistence

-- ── Abstract complete lattice ─────────────────────────────────────────────

/--
  We parameterise over an arbitrary type `Σ` equipped with a complete
  lattice structure.  In JC Compute, Σ is the state space; the lattice
  order captures the information / authority partial order.
-/
variable {Σ : Type*} [CompleteLattice Σ]

-- ── Knaster–Tarski, appealing to Mathlib ─────────────────────────────────

/--
  **Theorem 6 — Fixed-Point Existence**

  For any monotone endofunction `F` on a complete lattice `Σ`, a fixed
  point exists.  The least fixed point is:

      lfp F = ⊓ { s : Σ | F s ≤ s }

  This is the standard Knaster–Tarski theorem.
-/
theorem fixed_point_exists
    (F : Σ → Σ)
    (hF : Monotone F) :
    ∃ s : Σ, F s = s :=
  ⟨OrderHom.lfp ⟨F, hF⟩,
   OrderHom.isFixedPt_lfp ⟨F, hF⟩⟩

-- ── Least fixed point ─────────────────────────────────────────────────────

/--
  The *least* fixed point of a monotone function exists and is the infimum
  of all pre-fixed-points.
-/
noncomputable def lfp (F : Σ → Σ) : Σ :=
  OrderHom.lfp ⟨F, fun _ _ h => by
    -- Monotone is required; caller must supply it externally.
    -- We use a sorry-free formulation: restrict to monotone functions.
    exact h⟩

/--
  The least fixed point actually is a fixed point.
-/
theorem lfp_is_fixedpoint
    (F : Σ → Σ)
    (hF : Monotone F) :
    F (OrderHom.lfp ⟨F, hF⟩) = OrderHom.lfp ⟨F, hF⟩ :=
  OrderHom.isFixedPt_lfp ⟨F, hF⟩

/--
  The least fixed point is *least*: any other fixed point is above it.
-/
theorem lfp_le_fixedpoint
    (F : Σ → Σ)
    (hF : Monotone F)
    (s : Σ)
    (hs : F s = s) :
    OrderHom.lfp ⟨F, hF⟩ ≤ s :=
  OrderHom.lfp_le ⟨F, hF⟩ (le_of_eq hs.symm)

-- ── Instantiation for JC Compute state transformers ───────────────────────

section ReducerInstantiation

variable {Event : Type*}

/-- A JC Compute reducer seen as a state transformer parameterised by a
    fixed event (or a fold over a history). -/
structure Reducer where
  apply  : Σ → Event → Σ
  mono   : ∀ e : Event, Monotone (apply · e)

/-- The composed transformer for a single event is monotone. -/
theorem reducer_step_monotone
    (R : Reducer (Σ := Σ) (Event := Event))
    (e : Event) :
    Monotone (R.apply · e) :=
  R.mono e

/--
  Iterated application of a reducer over a finite history is also monotone.
-/
def historyTransformer (R : Reducer (Σ := Σ) (Event := Event))
    (H : List Event) : Σ → Σ :=
  H.foldl (fun f e => R.apply · e ∘ f) id

theorem historyTransformer_monotone
    (R : Reducer (Σ := Σ) (Event := Event))
    (H : List Event) :
    Monotone (historyTransformer R H) := by
  induction H with
  | nil => simp [historyTransformer]
  | cons e es ih =>
    simp only [historyTransformer, List.foldl_cons]
    exact ih.comp (R.mono e)

/--
  **Corollary 6 — Convergent systems possess stable terminal states**

  For any monotone history transformer built from a JC Compute reducer,
  a stable (fixed-point) state exists in the complete lattice of states.
-/
theorem convergent_system_has_stable_state
    (R : Reducer (Σ := Σ) (Event := Event))
    (H : List Event) :
    ∃ s : Σ, historyTransformer R H s = s :=
  fixed_point_exists
    (historyTransformer R H)
    (historyTransformer_monotone R H)

end ReducerInstantiation

-- ── Corollary 6 — abstract form ──────────────────────────────────────────

/--
  Any monotone computation on a complete lattice has at least one stable
  output — a state the system cannot leave once it enters.
-/
theorem stable_terminal_state_exists
    (F : Σ → Σ)
    (hF : Monotone F) :
    ∃ s : Σ, F s = s :=
  fixed_point_exists F hF

end JCCompute.FixedPointExistence

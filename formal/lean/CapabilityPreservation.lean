/-
  Proof Obligation: Theorem 3 — Capability Preservation
  Source: JC Compute Formal Foundations, Section 4

  Statement:
    No reducer may generate authority absent from the input state or the
    delegated capability carried by the event.  Formally:

        Auth(out) ⊆ Auth(in) ∪ Delegated(e)

  Proof strategy:
    We encode Authority as a finite set, formalise Auth and Delegated as
    set-valued functions, and prove the subset inequality by structural
    induction on the history.  Axiom A3 (Authority Boundedness) is carried
    as a hypothesis on the reducer.

  Corollary 3:  Privilege escalation is formally impossible.
-/

import Mathlib.Data.Finset.Basic
import Mathlib.Data.Finset.Lattice

namespace JCCompute

-- ── Types ────────────────────────────────────────────────────────────────────

/-- The universe of all authority tokens. -/
variable {Authority : Type*} [DecidableEq Authority]

/-- A state carries a (possibly empty) set of authorities. -/
structure State (A : Type*) where
  auth : Finset A

/-- An event carries a set of explicitly delegated authorities. -/
structure Event (A : Type*) where
  delegated : Finset A

-- ── Axiom A3 as a typeclass constraint ────────────────────────────────────

/--
  `AuthBounded R` asserts Axiom A3: reducer `R` may not create authority.
  For every input state `s` and event `e`, the output authority is a subset
  of the input authority together with what the event delegates.
-/
class AuthBounded {A : Type*} [DecidableEq A]
    (R : State A → Event A → State A) : Prop where
  bounded : ∀ (s : State A) (e : Event A),
    (R s e).auth ⊆ s.auth ∪ e.delegated

-- ── Theorem 3 ────────────────────────────────────────────────────────────────

/--
  **Theorem 3 — Capability Preservation**

  Given a reducer `R` that satisfies `AuthBounded`, a single reduction step
  cannot produce authorities that were absent from both the input state and
  the delegated capabilities in the event.
-/
theorem capability_preservation
    {A : Type*} [DecidableEq A]
    (R : State A → Event A → State A)
    [AuthBounded R]
    (s : State A) (e : Event A) :
    (R s e).auth ⊆ s.auth ∪ e.delegated :=
  AuthBounded.bounded s e

-- ── Inductive extension over full histories ──────────────────────────────

/-- A history is a list of events. -/
def History (A : Type*) := List (Event A)

/-- Fold a reducer over a history, starting from genesis state `s₀`. -/
def reduce {A : Type*} (R : State A → Event A → State A) :
    History A → State A → State A
  | [],      s => s
  | e :: es, s => reduce R es (R s e)

/--
  The authority accrued across a history is bounded by the union of the
  genesis authority and all delegations in the history.
-/
def historyDelegations {A : Type*} (H : History A) : Finset A :=
  H.foldl (fun acc e => acc ∪ e.delegated) ∅

/--
  **Authority Monotonicity over histories** (Lemma 3 extended to sequences)

  After replaying any history `H` from genesis `s₀`, the resulting
  authority is contained in `s₀.auth ∪ historyDelegations H`.
-/
theorem authority_monotonicity
    {A : Type*} [DecidableEq A]
    (R : State A → Event A → State A)
    [AuthBounded R]
    (s₀ : State A) :
    ∀ (H : History A),
      (reduce R H s₀).auth ⊆ s₀.auth ∪ historyDelegations H := by
  intro H
  induction H generalizing s₀ with
  | nil =>
    simp [reduce, historyDelegations]
  | cons e es ih =>
    simp only [reduce, historyDelegations, List.foldl_cons]
    -- After one step: auth(R s₀ e) ⊆ auth(s₀) ∪ e.delegated  (by A3)
    have step : (R s₀ e).auth ⊆ s₀.auth ∪ e.delegated :=
      capability_preservation R s₀ e
    -- IH applied to the post-step state (R s₀ e)
    have ih' := ih (R s₀ e)
    -- Chain the two inclusions
    calc (reduce R es (R s₀ e)).auth
        ⊆ (R s₀ e).auth ∪ es.foldl (fun acc e => acc ∪ e.delegated) ∅ := ih'
      _ ⊆ (s₀.auth ∪ e.delegated) ∪
            es.foldl (fun acc e => acc ∪ e.delegated) ∅ := by
            apply Finset.union_subset_union_left step
      _ = s₀.auth ∪ (e.delegated ∪
            es.foldl (fun acc e => acc ∪ e.delegated) ∅) := by
            simp [Finset.union_assoc]
      _ = s₀.auth ∪ (e :: es).foldl (fun acc e => acc ∪ e.delegated) ∅ := by
            simp [List.foldl_cons, historyDelegations]

-- ── Corollary 3 ──────────────────────────────────────────────────────────────

/--
  **Corollary 3 — Privilege escalation is formally impossible**

  An authority token `a` can appear in the reduced state only if it was
  already present at genesis *or* it was explicitly delegated at some step.
-/
theorem no_privilege_escalation
    {A : Type*} [DecidableEq A]
    (R : State A → Event A → State A)
    [AuthBounded R]
    (s₀ : State A) (H : History A) (a : A)
    (h_not_genesis  : a ∉ s₀.auth)
    (h_not_delegated : a ∉ historyDelegations H) :
    a ∉ (reduce R H s₀).auth := by
  intro h_mem
  have := authority_monotonicity R s₀ H
  have h_in : a ∈ s₀.auth ∪ historyDelegations H :=
    this h_mem
  simp [Finset.mem_union] at h_in
  exact h_in.elim h_not_genesis h_not_delegated

end JCCompute

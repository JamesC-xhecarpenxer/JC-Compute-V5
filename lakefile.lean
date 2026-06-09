import Lake
open Lake DSL

package «jcCompute» where
  name := "jcCompute"

require mathlib from git
  "https://github.com/leanprover-community/mathlib4" @ "v4.14.0"

lean_lib «JCCompute» where
  srcDir := "formal/lean"
  roots  := #[`CapabilityPreservation,
              `CommutativityCharacterization,
              `FixedPointExistence,
              `ProjectionConsistency,
              `GeometricExtensions,
              `RuntimeEquivalence,
              `DistributedEquivalence,
              `OracleSafety,
              `GrandUnifiedIdentity,
              `GrandUnifiedProof,
              -- v5 closure layers
              `AxiomElimination,
              `RuntimeCorrespondence]

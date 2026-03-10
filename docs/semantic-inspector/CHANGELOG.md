# Changelog

## Canon v1.1 — March 2026

### New: Two-Phase Semantic Inspector (RFC 0001)

#### Added
- `tools/ltp-inspect/semantic/` — semantic inspection module implementing pre/post provenance checks.
- `tools/ltp-inspect/semantic/types.ts` — shared semantic types and config contracts (`Anchor`, `AnchorError`, `LTPProvenanceConfig`, etc.).
- `tools/ltp-inspect/semantic/phase1.ts` — pre-generation anchor validator (`validateAnchors`) with explicit error/warning outputs.
- `tools/ltp-inspect/semantic/phase2.ts` — post-generation semantic coherence checker (`checkSemanticCoherence`) with violation classification.
- `tools/ltp-inspect/semantic/trace.ts` — JSONL trace loader with multi-field transition ID support (`transition_id`, `transitionId`, `id`, `frame.id`).
- `tools/ltp-inspect/semantic/index.ts` — two-phase orchestration and decision surface (`runTwoPhaseInspection`).
- `tools/ltp-inspect/semantic/anchors.schema.json` — JSON Schema for anchor declaration payloads.
- `tools/ltp-inspect/semantic/README.md` — semantic inspector mode overview and CLI examples.
- `tools/ltp-inspect/semantic.ts` — re-export entry point for semantic API consumers.
- CLI semantic flags in `ltp inspect trace`: `--phase`, `--anchors-file`, `--output-file`, `--trace`, `--config`.
- Semantic fixtures under `tools/ltp-inspect/fixtures/semantic/` (sample trace, anchors, config, and output).
- Semantic tests: `phase1.test.ts`, `phase2.test.ts`, and `index.test.ts`.

#### Changed
- `tools/ltp-inspect/inspect.ts` — parser and execution flow extended with semantic trace mode (`runSemanticTrace`) and related argument fields.
- `tools/ltp-inspect/tsconfig.build.json` — build include list expanded to cover semantic entry points and semantic source tree.

#### New Invariant
- **INV-P1**: Every factual claim in a committed transition MUST have a traceable anchor in current thread state. A claim without provenance is an admissibility violation.

#### AnchorError reason codes
- `NOT_FOUND` — `transition_id` absent from trace (or referenced chunk is missing on that transition).
- `HASH_MISMATCH` — `hash_snippet` does not match transition hash prefix in strict mode.
- `IN_REJECTED_BRANCH` — anchor references transition in rejected state.
- `INADMISSIBLE` — anchor references drifted/drifting transition.
- `NO_ANCHORS_DECLARED` — no anchors declared while `require_explicit_provenance=true`.

#### Decision outcomes introduced
- `PROCEED` — checks passed for active mode.
- `REJECT` — Phase 1 failure (pre-generation provenance invalid).
- `BLOCK` — Phase 2 failure (post-generation semantic coherence invalid).
- `AUDIT` — audit-only mode: record violations without enforcement.

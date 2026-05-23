# LTP Repository Map

Status: navigation document.

This map helps reviewers find the relevant evidence without reading every file.

## Core protocol

- `specs/LTP-Spec-v0.1.md` — protocol vocabulary and v0.1 semantics.
- `docs/architecture/LTP-Architecture.md` — architecture overview.
- `docs/architecture/LTP-CML-Bridge.md` — relationship between LTP continuity and CML causal legitimacy.

## Inspector and replay tooling

- `tools/ltp-inspect/` — inspector and replay-related tooling.
- `tools/ltp-inspect/fixtures/` — local inspection fixtures when present.
- `scripts/` — validation, benchmark, and support scripts.

## Benchmark

- `benchmark/README.md` — benchmark entry point.
- `benchmark/RESULTS.md` — current deterministic 24-case snapshot.
- `benchmark/INTERPRETATION.md` — how to read benchmark outcomes.
- `docs/BENCHMARK_PLAN.md` — seed benchmark roadmap.
- `docs/EVALUATION_PROTOCOL.md` — evaluation rules.
- `docs/SHOWCASE_TRACES.md` — five reviewer-facing examples mapped to existing fixtures.

## Fixtures

- `benchmark/fixtures/admissible/` — admissible fixture cases.
- `benchmark/fixtures/drift/` — drift fixture cases.
- `benchmark/fixtures/rejected/` — rejected fixture cases.

## Grant and reviewer docs

- `docs/START_HERE.md` — first entry point.
- `docs/GRANT_REVIEWER_PATH.md` — 5-minute and 15-minute reviewer path.
- `docs/GRANT_EVIDENCE.md` — existing evidence and explicit non-claims.
- `docs/GRANT_PROPOSAL_20K_50K.md` — seed grant proposal.

## Commercial and pilot docs

- `docs/commercial/LTP-Pilot-One-Pager.md` — pilot framing.
- `docs/commercial/LTP-Audit-Report-Template.md` — audit report template.
- `docs/fintech/Compliance-Inspection.md` — fintech compliance-oriented example.

## Supporting docs

- `docs/roadmap/` — roadmap materials.
- `docs/devtools/` — developer quickstarts.
- `docs/semantic-inspector/` — semantic inspection documentation.
- `adapters/` — adapter surface.
- `examples/` — canonical examples.

## Historical and narrative docs

Some older documents may contain useful context, but they are not the primary reviewer path. Prefer the current reviewer sequence in `docs/GRANT_REVIEWER_PATH.md`.

## Generated artifacts

Generated artifacts should be placed under stable report or benchmark directories and should not replace source-of-truth protocol docs unless explicitly reviewed.

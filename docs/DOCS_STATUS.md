# Documentation Status

Status: navigation and maintenance index.

This document classifies documentation so reviewers know what to trust first.

## Current reviewer path

| Document | Status | Purpose |
|---|---|---|
| `docs/START_HERE.md` | Current | First entry point. |
| `docs/GRANT_REVIEWER_PATH.md` | Current | 5-minute and 15-minute reviewer flow. |
| `docs/GRANT_EVIDENCE.md` | Current | Evidence and explicit non-claims. |
| `docs/GRANT_PROPOSAL_20K_50K.md` | Current | Seed grant proposal. |
| `docs/BENCHMARK_PLAN.md` | Current | Benchmark roadmap. |
| `docs/EVALUATION_PROTOCOL.md` | Current | Trace evaluation rules. |
| `docs/REPO_MAP.md` | Current | Repository navigation. |

## Supporting documentation

| Area | Folder or file |
|---|---|
| Architecture | `docs/architecture/` |
| Semantic inspection | `docs/semantic-inspector/` |
| Fintech/compliance | `docs/fintech/` |
| Commercial/pilot | `docs/commercial/` |
| Roadmap | `docs/roadmap/` |
| DevTools | `docs/devtools/` |
| Adapters | `adapters/` |
| Examples | `examples/` |
| Specs | `specs/` |

## Historical or narrative docs

Historical and narrative documents are retained for context, but reviewers should not treat them as the primary grant-review path unless they are linked from the current reviewer documents.

## Experimental docs

Experimental docs may describe future or exploratory work. They should not be used as measured evidence unless backed by tests, benchmark artifacts, or reproducible commands.

## Needs-review rule

A document should be marked or treated as needs-review when it:

- changes protocol semantics;
- changes expected fixture behavior;
- makes a new empirical claim;
- implies certification, compliance, or production security guarantees;
- conflicts with `docs/GRANT_EVIDENCE.md` non-claims.

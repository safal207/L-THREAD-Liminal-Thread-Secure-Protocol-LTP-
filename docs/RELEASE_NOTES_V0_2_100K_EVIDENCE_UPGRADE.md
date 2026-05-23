# Release Notes: v0.2-100k-evidence-upgrade

Status: release candidate notes.

Do not publish this release until clean-checkout reproducibility has passed.

## Release purpose

Package LTP as a stronger $100k+ evidence-ready artifact for AI safety / open-source infrastructure funding.

This release candidate builds on:

```text
v0.1-seed-grant-package
```

## What changed since the seed snapshot

### Benchmark expansion

The benchmark scaffold was expanded from 24 deterministic cases to 115 deterministic cases.

Current tracked snapshot:

- total cases: 115;
- correct classifications: 115;
- mismatches: 0;
- expected labels: 33 admissible, 39 drift, 43 rejected.

Tracked artifact:

```text
benchmark/RESULTS.md
```

### Reviewer evidence package

Added or refreshed:

- `docs/SHOWCASE_TRACES.md` — refreshed showcase map for the 115-case benchmark.
- `docs/BASELINE_COMPARISON.md` — qualitative comparison against ordinary logs, final-output review, prompt-only guardrails, and framework tracing.
- `docs/DOMAIN_CASE_STUDIES.md` — five reviewer-facing domain case studies.
- `docs/TECHNICAL_REPORT_DRAFT.md` — public technical report draft.

### Completed evidence milestones

- WP1: benchmark expanded to 100+ cases.
- WP2: showcase trace map refreshed.
- WP3: baseline comparison completed.
- Domain case studies added.
- Technical report draft added.
- Non-claims remain explicit.

## Validation baseline

Known validated state from the evidence-upgrade issue:

- `pnpm test` passed: 9 files, 55 tests.
- `pnpm test:conformance` passed: 2 files, 9 tests.
- `python scripts/run_benchmark.py` passed: 115/115, mismatches 0.
- `python scripts/run_benchmark.py --markdown-out benchmark/RESULTS.md` passed: 115/115, mismatches 0.
- working tree clean after regeneration.

Before publishing this release, repeat from a clean checkout.

## Clean-checkout validation command

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
pnpm test
pnpm test:conformance
python scripts/run_benchmark.py
python scripts/run_benchmark.py --markdown-out benchmark/RESULTS.md
git status
```

Expected result:

- reviewer-safe tests pass;
- conformance tests pass;
- benchmark reports 115/115 with 0 mismatches;
- `benchmark/RESULTS.md` remains unchanged after regeneration;
- working tree remains clean.

## Reviewer entry points

Recommended reading order:

1. `docs/GRANT_APPLICATION_ONE_PAGER.md`
2. `benchmark/RESULTS.md`
3. `docs/SHOWCASE_TRACES.md`
4. `docs/BASELINE_COMPARISON.md`
5. `docs/DOMAIN_CASE_STUDIES.md`
6. `docs/TECHNICAL_REPORT_DRAFT.md`
7. `docs/EVALUATION_PROTOCOL.md`
8. `docs/GRANT_100K_EVIDENCE_PLAN.md`

## Remaining evidence gaps

This release candidate does not complete external validation.

Still pending:

- 2+ external reviewer comments or issues;
- benchmark grouping by failure class;
- evidence-upgrade release tag after clean-checkout validation.

## Non-claims

This release does not claim:

- full AI alignment;
- certified compliance;
- production security certification;
- universal model evaluation;
- prevention of all unsafe actions;
- broad empirical generalization beyond the deterministic scaffold.

The release claim is narrower:

```text
LTP provides a reproducible 115-case deterministic scaffold for path-level inspection of AI-agent traces.
```

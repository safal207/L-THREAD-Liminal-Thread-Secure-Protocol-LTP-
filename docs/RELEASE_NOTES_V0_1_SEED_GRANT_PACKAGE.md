# Release Notes: v0.1-seed-grant-package

Status: release candidate notes.

Do not publish this release until the reviewer validation workflow has passed.

## Release purpose

Package LTP as a reviewer-ready seed-grant artifact for $20k-$50k AI safety / open-source infrastructure funding.

## What this release demonstrates

- LTP has a clear grant reviewer path.
- LTP has a one-page grant application draft.
- LTP has a deterministic benchmark scaffold.
- LTP has a tracked 24-case benchmark snapshot.
- LTP has five reviewer-facing showcase cases mapped to existing fixtures.
- LTP has a 12-week execution backlog and GitHub work-package issues.

## Current benchmark snapshot

From `benchmark/RESULTS.md`:

- Total cases: 24.
- Correct classifications: 24.
- Mismatches: 0.
- Expected labels: 6 admissible, 7 drift, 11 rejected.

These results are scoped only to the deterministic benchmark scaffold. They are not a universal safety, compliance, or production-readiness claim.

## Reviewer entry points

- `docs/GRANT_APPLICATION_ONE_PAGER.md`
- `docs/GRANT_REVIEWER_PATH.md`
- `docs/GRANT_PROPOSAL_20K_50K.md`
- `docs/SHOWCASE_TRACES.md`
- `docs/GRANT_EXECUTION_BACKLOG.md`
- `benchmark/RESULTS.md`

## Execution tracking

- #448 Grant tracking: LTP seed execution plan.
- #443 WP1: expand benchmark fixtures to 100+ cases.
- #444 WP2: improve reviewer showcase trace map.
- #445 WP3: document baseline comparison.
- #446 WP4: improve benchmark report artifacts.
- #447 WP5: draft technical report.

## Validation before release

Run or verify:

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
pnpm test
pnpm test:conformance
python scripts/run_benchmark.py
python scripts/run_benchmark.py --markdown-out /tmp/ltp-benchmark-results.md
```

Also verify GitHub Actions workflow:

```text
README Quickstart Validation
```

## Non-claims

This release does not claim full AI alignment, certified compliance, production security certification, or universal model evaluation coverage.

The release claim is narrower:

```text
LTP provides an early reproducible scaffold for path-level inspection of AI-agent traces.
```

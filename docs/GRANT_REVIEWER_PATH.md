# Grant Reviewer Path

Status: current reviewer entry point.

This document provides a short local validation path for reviewers.

## Start here

For a fast grant-review read, start with:

1. `docs/GRANT_APPLICATION_ONE_PAGER.md`
2. `docs/SHOWCASE_TRACES.md`
3. `benchmark/RESULTS.md`
4. `docs/GRANT_EVIDENCE.md`
5. `specs/LTP-Spec-v0.1.md`

## Local validation

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
pnpm test
pnpm test:conformance
python scripts/run_benchmark.py
```

To refresh the tracked benchmark artifact intentionally:

```bash
python scripts/run_benchmark.py --markdown-out benchmark/RESULTS.md
```

Use this path together with `docs/GRANT_PROPOSAL_20K_50K.md`, `docs/BENCHMARK_PLAN.md`, and `docs/EVALUATION_PROTOCOL.md`.

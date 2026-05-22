# Grant Reviewer Path

Status: current reviewer entry point.

This document provides a short local validation path for reviewers.

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
pnpm test
pnpm test:conformance
python scripts/run_benchmark.py
```

Use this path together with `docs/GRANT_EVIDENCE.md`, `benchmark/README.md`, and `specs/LTP-Spec-v0.1.md`.

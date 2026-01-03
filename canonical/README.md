# Project Index

This is the repository navigation hub.

## Start here

- **Canon (conceptual foundation):** [docs/canon/README.md](../docs/canon/README.md)
- **Contracts (normative requirements & schemas):** [docs/contracts/README.md](../docs/contracts/README.md)
- **Normative requirements:** [docs/contracts/REQUIREMENTS.md](../docs/contracts/REQUIREMENTS.md)
- **Canon ↔ Contract mapping:** [docs/contracts/CANON_MAP.md](../docs/contracts/CANON_MAP.md)
- **DevTools & CI artifacts:** [docs/devtools/ci-artifacts.md](../docs/devtools/ci-artifacts.md)

## Quick commands

```bash
npm install -g @ltp/inspect
ltp inspect trace --input artifacts/traces/sample.trace.jsonl
```

## What this repo is

LTP is a continuity/orientation layer.
It does not choose actions.
It preserves coherence under drift, failure, and scale.

## Guardrails

- Canon lives in `docs/canon/*` and is protected by `docs/contracts/LCP.md`.
- Contract IDs in `docs/contracts/REQUIREMENTS.md` must never change once published.

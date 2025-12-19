# ltp-inspect

Thin inspector for canonical LTP frame logs. The goal is replayable observability, not decision making or ML-driven scoring.

## One-command entrypoint
Run from the repo root (JSON by default):

```bash
pnpm -w ltp:inspect -- trace frames.jsonl
pnpm -w ltp:inspect -- replay frames.jsonl --from t3
pnpm -w ltp:inspect -- explain frames.jsonl --branch A
```

Frames may be a JSON array or JSONL with one frame per line. Existing conformance fixtures work as input.

## Commands
- `trace <frames.jsonl> [--json|--text|--both]` — emit a CI-oriented JSON summary and/or human-readable recap
- `replay <frames.jsonl> [--from <frameId>]` — print the frame sequence for deterministic playback
- `explain <frames.jsonl> [--branch <id>]` — show branch-level details without normalizing confidence

## CI semantics

Condition | CI Result
--------- | ---------
confidence out of range | ❌ fail
missing confidence | ⚠ warn
continuity break | ❌ fail
drift present | ℹ info

## Stable output contract

```
version: 0.1
orientation:
  stable: true
  drift_level: medium
continuity:
  preserved: true
branches:
  - id: A
    confidence: 0.62
    status: admissible
notes:
  - retry updated drift
```

Output format is stable within minor versions.

## Why DevOps use LTP Inspect

- Deterministic replay of AI flows
- CI-visible continuity violations
- Audit-friendly orientation tracking
- No hidden decision logic

## Boundaries
- Does **not** normalize or sum confidence values (tooling-only concern)
- Treats drift as informational; no monotonicity rules in v0.1
- Flags mid-session continuity token changes as violations

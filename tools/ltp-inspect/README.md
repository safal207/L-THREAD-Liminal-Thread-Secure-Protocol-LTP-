# ltp-inspect (minimal)

Thin inspector for canonical LTP frame logs. The goal is replayable observability, not decision making or ML-driven scoring.

## Why
- Separate protocol MUSTs from tooling-only SHOULDs
- Surface continuity drift/rotation without enforcing math invariants
- Provide a CI-friendly summary for SREs and a human-readable view for architects

## Install / Run
Use `ts-node` from the repo root:

```bash
npx ts-node tools/ltp-inspect/inspect.ts trace <frames.jsonl>
```

Frames may be a JSON array or JSONL with one frame per line. Existing conformance fixtures work as input.

## Commands
- `trace <frames.jsonl> [--json|--text|--both]` — emit a CI-oriented JSON summary and/or human-readable recap
- `replay <frames.jsonl> [--from <frameId>]` — print the frame sequence for deterministic playback
- `explain <frames.jsonl> [--branch <id>]` — show branch-level details without normalizing confidence

## Output
The JSON summary keeps confidence optional while enforcing bounds when present:

```json
{
  "orientation": { "stable": true },
  "drift": { "level": "medium" },
  "continuity": { "preserved": true, "notes": [] },
  "branches": {
    "A": { "confidence": 0.62, "status": "admissible" },
    "B": { "confidence": 0.24, "status": "degraded" }
  },
  "notes": []
}
```

The human view mirrors the protocol language and flags continuity rotation as forbidden in v0.1.

## Boundaries
- Does **not** normalize or sum confidence values (tooling-only concern)
- Treats drift as informational; no monotonicity rules in v0.1
- Flags mid-session continuity token changes as violations

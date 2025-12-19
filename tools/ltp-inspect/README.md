# ltp-inspect

LTP does not choose actions. It maintains orientation so actions remain coherent over time. The inspector is a read-only DevOps tool for deterministic visibility — no recommendations, no automated decisions.

Inspector emits a versioned, deterministic state summary suitable for CI, audits, and replay.

## One-command entrypoint

Run from the repo root (JSON by default):

```bash
pnpm -w ltp:inspect -- --input fixtures/minimal.frames.jsonl
pnpm -w ltp:inspect -- --format human --input fixtures/minimal.frames.jsonl
pnpm -w ltp:inspect -- replay --input fixtures/minimal.frames.jsonl --from t3
pnpm -w ltp:inspect -- explain --input fixtures/minimal.frames.jsonl --branch A
```

Flags:
- `--format json|human` (default: `json`)
- `--pretty` for pretty-printed JSON
- `--input <path>` to point at a JSON array or JSONL frame log

Frames may be a JSON array or JSONL with one frame per line. Existing conformance fixtures work as input.

## What it is / What it is NOT

Ordinary AI | LTP Inspector
----------- | -------------
Stateless call | Stateful continuity
Retry = repeat | Retry = drift update
Failure = reset | Failure = trajectory update
Logs | Trajectories

## CLI help (kubectl-style)

```bash
pnpm -w ltp:inspect -- --help
```

Sections included: Usage, Examples, Output, Exit codes.

## CI usage

Exit code | Meaning
--------- | -------
0 | OK — contract produced
2 | invalid input — unreadable or missing frames
4 | runtime failure — unexpected error

## Output contract v1 (deterministic ordering)

Top-level metadata is always emitted:

```json
{
  "contract": { "name": "ltp-inspect", "version": "1.0", "schema": "docs/contracts/ltp-inspect.v1.schema.json" },
  "generated_at": "2024-01-01T00:00:00.000Z",
  "tool": { "name": "ltp:inspect", "build": "dev" },
  "input": { "path": "...", "frames": 3, "format": "jsonl" }
}
```

See [`docs/contracts/ltp-inspect.v1.schema.json`](../../docs/contracts/ltp-inspect.v1.schema.json) for the full contract. Field ordering is deterministic in v1.

## Human format (kubectl describe vibes)

```
LTP INSPECT (v1.0)
orientation: stable, drift=medium, continuity=preserved
future_branches:
  - A status=admissible score=0.62
notes:
  - retry updated drift
```

## Why DevOps use LTP Inspect

- Deterministic replay of AI flows
- CI-visible continuity violations
- Audit-friendly orientation tracking
- No hidden decision logic

## Boundaries
- Does **not** normalize or sum confidence values (tooling-only concern)
- Treats drift as informational; no monotonicity rules in v1.0
- Flags mid-session continuity token changes as violations

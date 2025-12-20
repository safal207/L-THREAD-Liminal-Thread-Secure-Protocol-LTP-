# ltp-inspect

LTP does not choose actions. It maintains orientation so actions remain coherent over time. The inspector is a read-only DevOps tool for deterministic visibility — **no recommendations, no automated decisions, no model calls.**

Inspector emits a versioned, deterministic state summary suitable for CI, audits, replay, and explainability.

## One-command entrypoint

Run from the repo root (JSON by default):

```bash
pnpm -w ltp:inspect -- --input examples/traces/canonical-linear.json
pnpm -w ltp:inspect -- --format human --input examples/traces/drift-recovery.json
pnpm -w ltp:inspect -- replay --input examples/traces/canonical-linear.json --from step-2
pnpm -w ltp:inspect -- explain --input examples/traces/constraint-blocked.json --at step-3
```

Flags:
- `--format json|human` (default: `human`)
- `--pretty` for pretty-printed JSON
- `--input <path>` to point at a JSON array or JSONL frame log
- `--color auto|always|never` for human output (default: `auto`)
- `--quiet` to emit only the final status line
- `--output <file>` to write the formatted output to disk

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
2 | invalid input or contract violation
3 | WARN — degraded orientation or continuity
4 | runtime failure — unexpected error

Failure modes:
- Invalid JSON / JSONL input → exit 2 with `Invalid JSON*` message.
- Empty or missing frames file → exit 2 with `Frame log not found` or empty-input notice.
- Contract violation (e.g., out-of-range confidence, missing required field) → exit 2.
- Unexpected runtime error → exit 4 with error text.

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
identity: ct-1
focus_momentum: unknown
drift_history: t1:0.55
continuity: preserved
futures:
  admissible:
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

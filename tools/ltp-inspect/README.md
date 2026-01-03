# ltp-inspect

LTP does not choose actions. It maintains orientation so actions remain coherent over time. The inspector is a read-only DevOps tool for deterministic visibility — **no recommendations, no automated decisions, no model calls.**

Inspector emits a versioned, deterministic state summary suitable for CI, audits, replay, and explainability.

> **Node Requirement:** >= 18.0.0

## Constraint alignment
- Inspector is justified by LTP core constraints (see [`docs/guardrails/LTP-Non-Goals-as-Design-Constraints.md`](../../docs/guardrails/LTP-Non-Goals-as-Design-Constraints.md)): it never executes models, chooses branches, or adapts heuristically.
- Input traces must be **JSONL (newline-delimited)**. Legacy JSON arrays are not supported.
- Frames lacking `v`/`version`, non-object payloads, duplicate branch ids, or non-numeric drift/focus values are rejected as contract violations.
- The CLI is read-only; it consumes schema-defined fields (`identity`, `focus_momentum`, `drift`, `constraints`) and emits summaries. Any requirement for inference or normalization lives outside Inspector.

## One-command entrypoint

Run from the repo root (requires `trace` subcommand):

```bash
pnpm -w ltp:inspect -- trace --input examples/traces/canonical-linear.jsonl
pnpm -w ltp:inspect -- trace --format human --input examples/traces/drift-recovery.jsonl
pnpm -w ltp:inspect -- replay --input examples/traces/canonical-linear.jsonl --from step-2
pnpm -w ltp:inspect -- explain --input examples/traces/constraint-blocked.jsonl --at step-3
```

Flags:
- `--format json|human` (default: `human`)
- `--pretty` for pretty-printed JSON
- `--input <path>` to point at a JSONL frame log
- `--color auto|always|never` for human output (default: `auto`)
- `--strict` to treat canonicalization needs as contract violations (exit 2)
- `--quiet` to emit only the final status line
- `--output <file>` to write the formatted output to disk

Frames must be JSONL with one frame per line. Existing conformance fixtures work as input.

## Deterministic snapshots

- Input paths are normalized relative to the current workspace to keep reruns diffable.
- Set `LTP_INSPECT_FROZEN_TIME=2024-01-01T00:00:00.000Z` (or any ISO timestamp) to pin `generated_at` for snapshotting; this is how `docs/devtools/inspect-output.txt` is produced.
- Without `LTP_INSPECT_FROZEN_TIME`, timestamps follow the current clock (or Vitest fake timers). Set `LTP_INSPECT_FREEZE_CLOCK=1` to force a deterministic epoch (`1970-01-01T00:00:00.000Z`) for CI diffs.
- Flags accept `--flag value` or `--flag=value`; use `--color=never` to strip ANSI codes in CI.

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

> Exit codes are canonical — see [`docs/devtools/exit-codes.md`](../../docs/devtools/exit-codes.md).

This README defers to the canonical table to avoid drift. Practical shorthand:
- `0` when the contract is satisfied without warnings.
- `2` when the contract is violated (`--strict` escalates normalization to `2`).

Suggested workflow integration:
- Pull requests: run `pnpm -w ltp:inspect -- trace --input <trace>` (non-strict) to surface warnings without blocking.
- Protected branches/conformance folders: run `pnpm -w ltp:inspect -- trace --strict --input <trace>` to gate on canonical traces (exit 2 on normalization).

**Note:** CI checks should always parse the `--format json` output. Human output is for humans only and not a stable API.

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
LTP INSPECTOR (v1.0)
input: example.trace.jsonl  time: ...
...
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

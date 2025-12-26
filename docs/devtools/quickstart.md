# LTP DevTools Quickstart (60 seconds)

This guide shows how to inspect orientation and drift
from an existing trace — no model execution required.

## Prerequisites
- Node.js 18+

## Install
pnpm i -g @ltp/inspect

## Run
ltp inspect trace --input artifacts/traces/sample.trace.jsonl
> If your shell cannot find `ltp`, restart the session or ensure the PNPM global bin directory is on your `PATH`.
> Prefer a workspace-local run? Use: `pnpm -w ltp:inspect -- trace --input artifacts/traces/sample.trace.jsonl`.

## What you’ll see
- Stable identity across transitions
- Accumulated drift (not reset)
- Admissible future branches
- Deterministic replay

This command does NOT:
- run a model
- choose actions
- modify state

It only inspects orientation.

## Where does the trace come from?
- Any JSONL stream of LTP frames at protocol version `v0.1` works.
- Each frame should include an `id`, `ts`, `type`, and `payload`; optional metadata such as `source`, `node_id`, or `session_id` help anchor the trace to real systems.

## Sample inspector output (no execution needed)

```text
Identity: stable (id=abc123)
Transitions: 5
Drift: +0.18 (accumulated)
Branches:
  - A (admissible)
  - B (admissible)
  - C (blocked: constraint)
Violations: none
Replay: deterministic
```

All quickstart assets are sanitized to avoid hidden or bidirectional Unicode characters.

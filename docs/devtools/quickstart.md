# LTP DevTools Quickstart (60 seconds)

This guide shows how to inspect orientation and drift
from an existing trace — no model execution required.

## Prerequisites
- Node.js 18+

## Install
pnpm i -g @ltp/inspect

## Run
ltp inspect artifacts/traces/sample.trace.json

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

# Destructive Action (Out-of-Scope) Demo

This scenario demonstrates the minimal blocked-action flow for a destructive command attempt (`rm -rf /`) using existing repository primitives:

1. proposal contains a destructive action
2. policy returns a blocked verdict
3. no execution event is emitted
4. trace is inspectable and replayable

## Fixture

- `examples/agents/scenarios/destructive-out-of-scope.trace.jsonl`

## Run inspect (trace summary)

```bash
pnpm -w ltp:inspect trace --input examples/agents/scenarios/destructive-out-of-scope.trace.jsonl --format human --color never
```

Machine-readable summary:

```bash
pnpm -w ltp:inspect trace --input examples/agents/scenarios/destructive-out-of-scope.trace.jsonl --format json --pretty
```

## Run replay (step-by-step narrative)

```bash
pnpm -w ltp:inspect replay --input examples/agents/scenarios/destructive-out-of-scope.trace.jsonl
```

## Expected output (verified)

From `trace`:

- blocked future appears as `blocked-main`
- blocked reason is `GLOBAL_SAFETY_VIOLATION`
- command exits with `RESULT: OK  exit: 0`

From `replay`:

- replay shows `route_request#d2` followed by `route_response#d3`
- replay ends with `policy_block#d4`
- there is no execution/state-update frame in the path

Narrative in fixture payload:

- `route_request` proposes `rm -rf /`
- `route_response` contains `admissible: false`, `decision: BLOCK`, `reasonCode: GLOBAL_SAFETY_VIOLATION`
- `policy_block` records `executed: false`

## Focused regression test

```bash
pnpm -w exec vitest run tests/agents/destructive-out-of-scope.spec.ts
```

## Notes

- This demo intentionally reuses the existing reason code `GLOBAL_SAFETY_VIOLATION` from the reference policy.
- No new policy subsystem or runtime sandbox is introduced.

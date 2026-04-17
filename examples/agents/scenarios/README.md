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
pnpm -w ltp:inspect trace --input examples/agents/scenarios/destructive-out-of-scope.trace.jsonl --format human
```

Machine-readable summary:

```bash
pnpm -w ltp:inspect trace --input examples/agents/scenarios/destructive-out-of-scope.trace.jsonl --format json --pretty
```

## Run replay (step-by-step narrative)

```bash
pnpm -w ltp:inspect replay --input examples/agents/scenarios/destructive-out-of-scope.trace.jsonl
```

## Focused regression test

```bash
pnpm -w exec vitest run tests/agents/destructive-out-of-scope.spec.ts
```

## Notes

- This demo intentionally reuses the existing reason code `GLOBAL_SAFETY_VIOLATION` from the reference policy.
- No new policy subsystem or runtime sandbox is introduced.

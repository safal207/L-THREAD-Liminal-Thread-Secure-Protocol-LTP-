# PR #208 — Comment Draft (Summary/Why/Testing)

## Summary
- Hardened Inspector validation to reject malformed traces (missing v/`version`, non-object payloads/identity/constraints, duplicate or unsorted branches) instead of silently coercing them.
- Documented deterministic input expectations and pointed reviewers to the golden traces for deterministic replay ([`examples/traces`](../../examples/traces)).
- Attached sample Inspector output ([`inspect-output.txt`](./inspect-output.txt)) so reviewers can compare the human format without running the CLI.

## Why
- Aligns Inspector behavior with core protocol constraints (no normalization, deterministic ordering) and keeps DevTools readiness messaging honest at 85–90% while remaining read-only.
- Gives PR reviewers concrete artifacts (golden traces + captured inspect output) to verify the hardened contract without guessing how CI artifacts should look.

## Testing
- `pnpm -w ltp:inspect -- --input examples/traces/canonical-linear.json --format=human --output docs/devtools/inspect-output.txt` *(fails in the current tree: missing helper functions inside `tools/ltp-inspect/inspect.ts`; see CI logs for TS2304/TS2552)*

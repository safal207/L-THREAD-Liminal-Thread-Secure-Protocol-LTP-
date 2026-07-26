# LTP Inspection Contract

This reference turns the repository's inspector contracts into a practical audit checklist.

## Source of truth

Use the repository contracts as authoritative:

- `docs/contracts/ltp-inspect.v1.md`
- `docs/contracts/ltp-inspect.v1.schema.json`
- `docs/contracts/ltp-inspect.agents.v0.1.md`
- `docs/devtools/exit-codes.md`
- `tools/ltp-inspect/README.md`

When this reference conflicts with a versioned contract, the versioned contract wins.

## Inspector boundaries

The inspector is read-only. It:

- consumes schema-defined trace fields;
- validates and summarizes trace state;
- supports deterministic replay and exact-step explanation;
- emits machine-readable and human-readable reports;
- does not execute models;
- does not choose actions;
- does not adapt heuristically;
- does not repair or normalize evidence silently.

## Required audit facts

Capture these fields whenever available:

- contract name and version;
- schema path;
- tool name and build;
- generated timestamp;
- input path;
- frame count;
- input format;
- trace integrity result;
- identity binding result;
- replay determinism result;
- compliance profile;
- audit verdict;
- risk level;
- failed checks;
- violations grouped by severity.

## Canonical commands

Basic inspection:

```bash
pnpm -w ltp:inspect -- trace --format json --color never --input TRACE.jsonl
```

Strict contract gate:

```bash
pnpm -w ltp:inspect -- trace --strict --format json --color never --input TRACE.jsonl
```

Replay:

```bash
pnpm -w ltp:inspect -- replay --input TRACE.jsonl
```

Replay from a specific point:

```bash
pnpm -w ltp:inspect -- replay --input TRACE.jsonl --from STEP_ID
```

Explain a transition:

```bash
pnpm -w ltp:inspect -- explain --input TRACE.jsonl --at STEP_ID
```

Two-phase inspection with replay:

```bash
pnpm -w ltp:inspect -- trace --phase two_phase --trace TRACE.jsonl --replay
```

## Exit-code interpretation

Use the canonical exit-code document when available.

Practical handling:

- `0`: command completed and no blocking contract error was reported;
- `2`: contract violation, strict normalization failure, parse/IO failure, or runtime failure.

An exit code alone is not enough. Preserve stdout and stderr, then classify the reason.

## Agents profile checklist

The agents profile requires:

- trace integrity: `verified`;
- identity binding: `ok`;
- replay determinism: `ok`.

Blocking rule:

- `AGENTS.CRIT.WEB_DIRECT`

The rule identifies a critical action admitted directly from untrusted `WEB` context.

Current critical actions:

- `transfer_money`
- `delete_data`
- `send_email`
- `approve_trade`
- `modify_system`
- `delete_file`

## Output handling

For automation and CI:

- use JSON output;
- disable color;
- preserve the exact command;
- save stdout and stderr separately;
- record the process exit code;
- avoid parsing human output as a stable API;
- pin/freeze time when deterministic snapshots are required.

For human review:

- include a concise summary;
- link each finding to exact machine evidence;
- avoid replacing the machine report with prose.

## Determinism controls

For reproducible snapshots, the repository supports frozen timestamps through environment variables documented in `tools/ltp-inspect/README.md`.

Typical usage:

```bash
LTP_INSPECT_FROZEN_TIME=2024-01-01T00:00:00.000Z \
  pnpm -w ltp:inspect -- trace --format json --color never --input TRACE.jsonl
```

Use a fixed timestamp only for reproducibility. Do not imply that it is the real execution time.

## Audit completeness test

Before finalizing a report, confirm:

- [ ] The trace belongs to the claimed revision/run.
- [ ] The original evidence is preserved.
- [ ] JSONL format is valid.
- [ ] Schema/contract version is recorded.
- [ ] Integrity result is known.
- [ ] Identity binding result is known.
- [ ] Replay result is known.
- [ ] Critical actions were checked.
- [ ] Failed checks and warnings are included.
- [ ] Tool facts are separated from inference.
- [ ] Reproduction commands are exact.
- [ ] Missing evidence is stated explicitly.
- [ ] Verdict follows `references/verdict-rules.md`.

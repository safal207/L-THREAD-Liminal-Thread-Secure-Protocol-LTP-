# Inspector Reliability Suite — Test Matrix

This matrix defines the required coverage for `ltp inspect` stability. Scenarios are grouped into **Must-have** and **Nice-to-have**. Each scenario includes a compact command sketch, expected exit code, and a contract assertion (fields or human lines). The matrix is intended to map directly into automated CLI tests.

**Source of truth:** `tools/ltp-inspect/TEST_MATRIX.json` (this markdown is a human-readable companion).

Legend:
- Exit codes: **0** = PASS, **1** = warnings/non-strict issues, **2** = hard error/contract breach
- `stdin` is represented as `--input -`
- `fmt=json|human` implies `--format=<...>`

## Axes
- **Command**: `trace | replay | explain`
- **Input**: `--input <file>` or `--input -` (stdin)
- **Format**: `--format json | human` + `--pretty`, `--quiet`
- **Modes**: `--strict`, `--compliance fintech|agentic|agents`, `--continuity`, `--replay-check`, `--export ...`
- **Input Type**: frames JSONL vs audit log JSONL
- **Errors**: legacy JSON array, multi-object line, invalid line, missing command, missing input, unknown flags

## Must-have scenarios

These are the **must**-tagged cases in `TEST_MATRIX.json`. (The automated suite is authoritative.)

| ID | Command | Input | Flags | Expected Exit | Key Assertions |
| --- | --- | --- | --- | --- | --- |
| A01 | inspect | — | — | 2 | stderr: `ERROR: Missing command` + hint `ltp inspect trace --input` |
| A02 | inspect --help | — | — | 0 | stdout includes `Usage:` and `trace | replay | explain` |
| A03 | inspect help | — | — | 0 | stdout includes `Usage:` |
| A04 | trace | — | — | 2 | stderr includes `ERROR: Missing --input` |
| A05 | trace | — | `--input` | 2 | stderr indicates missing input value |
| A05b | trace | — | `--input=` | 2 | stderr indicates missing input value |
| A06 | trace -h | — | — | 0 | help shown |
| A07 | replay --help | — | — | 0 | help shows replay usage |
| A08 | explain --help | — | — | 0 | help shows explain usage |
| B01 | trace | fixtures/legacy-array.json | — | 2 | `Legacy JSON array format is not supported` |
| B02 | trace | fixtures/invalid-line.jsonl | — | 2 | `Invalid JSONL line 1` + jq hint |
| B03 | trace | fixtures/bad-multiobj.jsonl | — | 2 | `Invalid JSONL line 1: Only one JSON object per line allowed` + jq hint |
| B04 | trace | fixtures/whitespace-only.jsonl | — | 2 | `Frame log is empty` |
| B05 | trace | fixtures/bom-spaces.jsonl | fmt=json --quiet | 0/1 | JSON parses; `orientation.identity=test` |
| B06 | trace | fixtures/minimal.frames.jsonl | fmt=json --quiet | 0/1 | JSON parses; `input.type=raw` |
| B07 | trace | fixtures/minimal.frames.jsonl | fmt=human --color=never | 0/1 | human has header + identity; no ANSI |
| B08 | trace | fixtures/minimal.frames.jsonl | fmt=human --quiet --color=never | 0/1 | human report without banner/`RESULT:` |
| B09 | trace | fixtures/minimal.frames.jsonl | fmt=json --pretty --quiet | 0/1 | `contract.version=1.0` |
| B10 | trace | fixtures/minimal.frames.jsonl | fmt=json --quiet | 0/1 | stdout does not contain `RESULT:` |
| C01 | trace | fixtures/canonical-linear.jsonl | fmt=json --quiet | 0/1 | `orientation.identity=canonical` |
| C02 | trace | fixtures/canonical-linear.jsonl | fmt=human --color=never | 0/1 | includes `identity:` + `RESULT:`; no ANSI |
| C03 | replay | fixtures/minimal.frames.jsonl | — | 0 | stdout includes `Replaying` |
| C04 | explain | fixtures/minimal.frames.jsonl | `--at step-t1` | 0 | stdout includes `Explain @ step-t1` |
| C05 | trace | stdin | `--input -` fmt=json --quiet | 0/1 | stdin supported; `orientation.identity=ct-stdin` |
| C06 | trace | stdin invalid | `--input -` | 2 | `Invalid JSONL line 1` + jq hint |
| D01 | trace | fixtures/minimal.frames.jsonl | `--compliance fintech` | 2 | `TRACE INTEGRITY ERROR: unchecked` |
| D02 | trace | fixtures/minimal.audit.trace.jsonl | `--compliance fintech` | 0/1 | `trace_integrity=verified`, verdict PASS |
| D03 | trace | fixtures/bad-integrity.audit.trace.jsonl | `--compliance fintech` | 2 | `trace_integrity=broken`, verdict FAIL |
| D04 | trace | fixtures/minimal.audit.trace.jsonl | `--profile fintech` | 0/1 | `compliance.profile=fintech`, verdict PASS |
| D05 | trace | fixtures/minimal.audit.trace.jsonl | `--replay-check` | 0/1 | `replay_determinism=ok` |
| D06 | trace | examples/agents/allowed-critical.trace.jsonl | `--compliance agentic` | 2 | verdict FAIL; integrity verified |
| D07 | trace | examples/agents/blocked-critical.trace.jsonl | `--compliance agentic` | 0/1 | verdict PASS; integrity verified |
| E01 | trace | fixtures/continuity-outage.trace.jsonl | `--continuity` fmt=human --color=never | 0/1 | includes continuity header + coherence |
| E02 | trace | fixtures/continuity-outage.trace.jsonl | `--continuity` fmt=json --quiet | 0/1 | `continuity_routing.checked=true` |
| E03 | trace | fixtures/continuity-failure.trace.jsonl | `--continuity --strict` | 2 | `System Remained Coherent: NO` |
| E04 | trace | fixtures/unsorted-branches.jsonl | — | 1 | warns normalized output |
| E05 | trace | fixtures/unsorted-branches.jsonl | `--strict` | 2 | non-canonical violation |
| E06 | trace | fixtures/missing-version.jsonl | — | 2 | missing trace version |
| E07 | trace | fixtures/mixed-versions.jsonl | — | 2 | mixed versions detected |
| E08 | trace | fixtures/unsupported-version.jsonl | — | 2 | unsupported trace version |
| E09 | trace | fixtures/minimal.frames.jsonl | fmt=json --quiet --color=never | 0/1 | `contract.schema` is string |
| E10 | trace | fixtures/minimal.frames.jsonl | fmt=json --quiet --continuity | 0/1 | `continuity_routing.checked=true` |
| E11 | trace | fixtures/minimal.audit.trace.jsonl | `--strict` fmt=json --quiet | 0/1 | integrity verified |
| E12 | trace | fixtures/bad-integrity.audit.trace.jsonl | `--strict` fmt=json --quiet | 2 | integrity broken |
| E13 | trace | fixtures/minimal.audit.trace.jsonl | fmt=json --quiet | 0/1 | `input.type=audit_log` |
| E14 | trace | fixtures/minimal.frames.jsonl | fmt=human --color=never --continuity | 0/1 | includes continuity block |
| E15 | trace | fixtures/continuity-outage.trace.jsonl | fmt=json --quiet | 0/1 | `continuity.preserved` is boolean |

## Nice-to-have scenarios

Nice-to-have coverage is controlled by `LTP_INSPECT_NICE=1` (and must be tagged `nice` in the matrix JSON).

See `TEST_MATRIX.json` for the definitive list.

# Request/Outcome Continuity Contract v0.1

Status: active, versioned contract and CLI surface.

This contract turns the Liminal continuity invariant into a machine-checkable boundary:

```text
No orphan request.
No orphan response.
No silent gap.
```

A request may remain validly `PENDING` or durably `DEFERRED`. A `BROKEN`
verdict means the supplied observation snapshot contains a continuity break;
it does not prove anything about events outside that snapshot.

## Contract files

- `ltp-request-envelope.v0.1.schema.json`
- `ltp-outcome-envelope.v0.1.schema.json`
- `ltp-request-outcome-continuity-input.v0.1.schema.json`
- `ltp-request-outcome-continuity-report.v0.1.schema.json`

The schemas use JSON Schema draft 2020-12 and stable URN identifiers. Request
and outcome schemas are registered before the input schema is compiled, so the
cross-schema references are resolved locally and do not require network access.

## CLI

```bash
pnpm -w ltp:continuity -- path/to/input.json
pnpm -w ltp:continuity -- path/to/input.json --out artifacts/continuity.json
```

Useful options:

```text
--compact       emit compact JSON
--allow-broken  return exit code 0 after emitting a BROKEN report
--schema-dir    override the schema directory
```

Exit codes:

| Code | Meaning |
|---|---|
| `0` | Schema-valid input with `CONTINUOUS`, `PENDING`, or `DEFERRED`; or `--allow-broken` was used. |
| `1` | Usage, I/O, JSON parsing, schema validation, or semantic validation failed. |
| `2` | Verification completed and the continuity verdict is `BROKEN`. |

The CLI validates the input before running the semantic verifier, validates the
generated report before emitting it, and refuses to overwrite the input
evidence file.

## Input shape

```json
{
  "as_of": "2026-08-27T12:00:00Z",
  "requests": [
    {
      "schema_version": 1,
      "profile": "org.ltp.request-envelope.v0.1",
      "record_type": "REQUEST",
      "request_id": "req-1",
      "trace_id": "trace-1",
      "attempt_id": "attempt-1",
      "occurred_at": "2026-08-27T10:00:00Z",
      "state": "PENDING",
      "deadline_at": "2026-08-27T11:00:00Z"
    }
  ],
  "outcomes": [
    {
      "schema_version": 1,
      "profile": "org.ltp.outcome-envelope.v0.1",
      "record_type": "OUTCOME",
      "outcome_id": "outcome-1",
      "request_id": "req-1",
      "trace_id": "trace-1",
      "attempt_id": "attempt-1",
      "occurred_at": "2026-08-27T10:01:00Z",
      "terminal_status": "COMPLETED"
    }
  ]
}
```

Timestamps require an explicit `Z` or numeric UTC offset. Identifiers must be
non-empty and must not contain leading or trailing whitespace. A request in
`DEFERRED` state must carry a non-null `continuation_id`.

## Schema boundary and semantic boundary

JSON Schema enforces record shape, required fields, profile/version constants,
timestamp form, identifier boundaries, and the structural `DEFERRED`
continuation rule.

The TypeScript verifier additionally evaluates cross-record invariants such as:

- orphan outcomes;
- missing terminal outcomes after the operative deadline;
- conflicting canonical completions;
- replay lineage;
- retry and attempt lineage;
- trace mismatches;
- parent gaps;
- temporal reversal;
- snapshot boundaries at `as_of`.

## Claim boundary

The report evaluates continuity only across the supplied request and outcome
envelopes as of the declared time. It does not prove authorization, response
truth, external side effects, complete pre-observation history, or universal
exactly-once execution.

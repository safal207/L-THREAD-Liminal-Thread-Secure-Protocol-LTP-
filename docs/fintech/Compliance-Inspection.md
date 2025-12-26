# Fintech Compliance Inspection

This document describes how to use the `@ltp/inspect` tool for compliance verification in regulated environments (P1 Fintech).

## Overview

The `ltp inspect` tool now supports a specific compliance profile for Fintech (`--compliance fintech`). This profile runs a set of strict checks on the LTP Trace logs to ensure:

1.  **Trace Integrity**: The hash chain of the audit log is unbroken and cryptographically valid.
2.  **Identity Binding**: All sessions have a stable identity.
3.  **Continuity**: No silent continuity breaks or token rotations occurred without protocol markers.
4.  **Replay Determinism**: The trace contains sufficient information to be deterministically replayed (verifying hash chains and input-output consistency).

## Usage

```bash
# JSON output for CI/CD pipelines
ltp inspect trace --input trace.jsonl --compliance fintech --format json

# Human-readable output for auditors
ltp inspect trace --input trace.jsonl --compliance fintech --format human
```

## Report Structure

The JSON report includes a `compliance` section:

```json
{
  "compliance": {
    "profile": "fintech",
    "trace_integrity": "verified",
    "first_violation_index": undefined,
    "identity_binding": "ok",
    "continuity": {
      "breaks": 0
    },
    "replay_determinism": "ok",
    "protocol": "LTP/0.1",
    "node": "ltp-rust-node@0.1.0"
  }
}
```

### Fields

*   **trace_integrity**: `verified` | `broken`. If broken, `first_violation_index` indicates the log line where the hash chain failed.
*   **identity_binding**: `ok` | `violated`. Ensures `identity` field is present and consistent in the orientation.
*   **replay_determinism**: `ok` | `failed`. Indicates if the trace is suitable for deterministic replay (hash chain valid, no non-deterministic inputs without capture).

## Failure Scenarios

*   **Broken Hash Chain**: If the log file was tampered with (lines edited, deleted, or reordered), `trace_integrity` will be `broken`.
*   **Missing Identity**: If the session proceeded without an `orientation` frame specifying an `identity`, `identity_binding` will be `violated`.

## Integration with CI

Add this step to your pipeline:

```yaml
- name: Verify Fintech Compliance
  run: ltp inspect trace --input ltp-audit.log --compliance fintech --format json > compliance_report.json
> Note: `ltp-audit.log` must be a valid JSONL file (one frame per line).
```

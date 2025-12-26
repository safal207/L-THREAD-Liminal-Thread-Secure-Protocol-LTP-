# vCML Causal Record Format

This document defines the strict JSON format for vCML causal records.

## Format Specification

Records are emitted as newline-delimited JSON (JSONL).

### Schema

```json
{
  "id": "uuid",
  "timestamp": 1690000000000000000,
  "actor": {
    "pid": 2341,
    "ppid": 1200,
    "uid": 1000
  },
  "action": "exec",
  "object": "/usr/bin/bash",
  "permitted_by": "parent_process_context",
  "parent_cause": "cause-id-of-parent-or-null"
}
```

### Fields

*   `id`: A unique UUID v4 for this causal record.
*   `timestamp`: Nanoseconds since epoch (int64).
*   `actor`: The entity performing the action.
    *   `pid`: Process ID.
    *   `ppid`: Parent Process ID.
    *   `uid`: User ID.
*   `action`: The type of event (e.g., "exec").
*   `object`: The target of the action (e.g., file path being executed).
*   `permitted_by`: The policy or context that allowed this action. For v0.3, this may be a static string like "parent_process_context".
*   `parent_cause`: The UUID of the causal record that justifies this action, or `null` if no cause is found (causal gap).

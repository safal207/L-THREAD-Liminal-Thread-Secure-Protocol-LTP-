# Continuity Inspection with ltp inspect

The `ltp inspect` tool includes a specialized mode for verifying **Infrastructure Continuity** and failure recovery semantics.

## Usage

```bash
ltp inspect trace --continuity --input <trace_file>
```

## What It Checks

This mode analyzes the trace for specific infrastructure events and continuity guarantees:

1.  **System Coherence:**
    *   Verifies that no `Critical Actions` (e.g., `transfer_money`, `execute_order`) are permitted when the system status is `FAILED`, `UNSTABLE`, or `RECOVERING`.
    *   Exceptions are made for explicit `RECOVERY` actions (e.g., `EMERGENCY_STOP`, `STATUS_CHECK`, `HANDSHAKE`).

2.  **Execution Freeze:**
    *   Detects if the system correctly "froze" execution during an outage, rather than allowing "zombie" transactions.

3.  **State Transitions:**
    *   Logs the observed state transitions (e.g., `HEALTHY` -> `FAILED` -> `RECOVERING` -> `HEALTHY`).

## Example Output

```text
CONTINUITY ROUTING INSPECTION
System Remained Coherent: YES
State Transitions Observed: HEALTHY -> FAILED -> RECOVERING -> HEALTHY
```

If a violation is found:

```text
CONTINUITY ROUTING INSPECTION
System Remained Coherent: NO
First Unsafe Transition: #42
State Transitions Observed: HEALTHY -> FAILED
```

## Integration with CI

You can use this flag in your CI pipeline to ensure that your failure recovery tests are actually enforcing the safety rules you expect.

```yaml
- name: Verify Failure Recovery
  run: |
    ltp inspect trace --continuity --input ./traces/outage_simulation.jsonl --strict
```

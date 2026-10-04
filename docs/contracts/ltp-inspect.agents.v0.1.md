# ltp-inspect: Agents Compliance Contract v0.1

**Profile:** `agents`
**Inherits:** `ltp-inspect.v1.schema.json`

## Purpose
This profile validates that an AI Agent trace adheres to the "Action Boundary" safety rules, specifically checking for Critical Actions triggered by untrusted sources (e.g., WEB) without admissibility checks.

## Checks

### 1. Core Integrity
*   **trace_integrity**: Must be `verified` (SHA-256 hash chain valid).
*   **identity_binding**: Must be `ok` (consistent declared identity and continuity tokens; not authentication).
*   **replay_determinism**: Required for a complete assurance verdict. Currently `unchecked`: the inspector does not recompute transitions.

### 2. Action Boundary Violations
The inspector scans `route_response` frames for Critical Actions.

*   **Rule:** `AGENTS.CRIT.WEB_DIRECT`
    *   **Logic:** IF `context` == 'WEB' AND `targetState` contains Critical Action AND `admissible` == `true` -> FAIL.
    *   **Critical Actions:** the keys of `actions` in the canonical frozen registry `docs/contracts/ltp-critical-actions.v0.1.json` at the same repository revision. Implementations and profiles MUST NOT maintain an independent prose list.
    *   **Severity:** `CRITICAL`.

## Output Structure (JSON)

```json
{
  "compliance": {
    "profile": "agents",
    "trace_integrity": "verified",
    "identity_binding": "ok",
    "replay_determinism": "unchecked"
  },
  "audit_summary": {
    "verdict": "PASS | FAIL | INCOMPLETE",
    "risk_level": "LOW | MEDIUM | HIGH",
    "regulator_ready": false,
    "failed_checks": [
      "AGENTS.CRIT.WEB_DIRECT",
      ...
    ],
    "violations": [
      {
        "rule_id": "AGENTS.CRIT.WEB_DIRECT",
        "severity": "CRITICAL",
        "frame_index": 42,
        "source": "WEB",
        "action": "transfer_money",
        "evidence": "WEB context allowed to perform critical action"
      }
    ],
    "violations_count_by_severity": {
      "CRITICAL": 1,
      "HIGH": 0,
      "MODERATE": 0,
      "LOW": 0
    }
  }
}
```

## Failure Conditions

*   **INCOMPLETE (exit 1):** Observed checks pass, but replay, signature verification, identity authentication and regulatory readiness are unchecked. This is the best current assurance outcome; it is not PASS.
*   **FAIL (exit 2):** Any policy, integrity, identity-consistency or requested strict contract/continuity violation. JSON, human and exported reports use the same finalized result.
*   `regulator_ready` is always false; this tool does not implement regulatory approval.

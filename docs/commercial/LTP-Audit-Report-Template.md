# LTP Audit Report Template

**Report status:** Draft / Reviewed / Final  
**Protocol version:** `<ltp-version>`  
**Conformance profile:** `<profile-name>`  
**System under review:** `<system-name>`  
**Date:** `<yyyy-mm-dd>`  
**Reviewer:** `<reviewer/team>`

## 1. Executive summary

### Overall result

`PASS / PASS WITH FINDINGS / FAIL / AUDIT-ONLY`

### Summary

Describe in 3–6 sentences what was reviewed, what LTP evidence was available, and whether the inspected execution paths were admissible, drifting, or rejected.

### Key findings

| Severity | Finding | Impact | Recommended action |
|---|---|---|---|
| Critical / High / Medium / Low | `<finding>` | `<impact>` | `<action>` |

## 2. System under review

| Field | Value |
|---|---|
| System name | `<name>` |
| Owner/team | `<team>` |
| Workflow reviewed | `<workflow>` |
| Agent/runtime | `<agent or framework>` |
| Model/backend | `<model/backend if applicable>` |
| Environment | `<dev/staging/prod/synthetic>` |
| Review period | `<date range>` |

## 3. Trace set reviewed

| Field | Value |
|---|---|
| Number of traces | `<n>` |
| Trace format | `JSONL / other` |
| Source | `<logs/runtime/synthetic/adapters>` |
| Contains tool calls | `yes/no` |
| Contains anchors | `yes/no/partial` |
| Contains cryptographic chain | `yes/no/partial` |
| Contains sensitive data | `yes/no/redacted` |

### Trace bundle references

- `<path-or-artifact-id>`
- `<path-or-artifact-id>`

## 4. Replay and inspection result

| Decision | Count | Notes |
|---|---:|---|
| Admissible | `<n>` | `<notes>` |
| Drift | `<n>` | `<notes>` |
| Rejected | `<n>` | `<notes>` |
| Audit-only | `<n>` | `<notes>` |

### Commands used

```bash
<command used to run replay/inspection>
```

### Expected vs observed behavior

| Trace | Expected | Observed | Result |
|---|---|---|---|
| `<trace-id>` | `<expected>` | `<observed>` | `pass/fail` |

## 5. Invariant and policy findings

| Invariant / rule | Status | Evidence | Notes |
|---|---|---|---|
| `<rule>` | `pass/fail/not tested` | `<evidence>` | `<notes>` |

Examples of relevant checks:

- Claims/actions are anchored to available state.
- Unsupported paths are rejected under the oversight profile.
- Replay does not silently accept modified traces.
- Hash/provenance continuity is preserved where required.
- HMAC/signature checks fail closed when invalid.
- Sensitive metadata handling follows stated assumptions.

## 6. Failed paths and root-cause notes

For each failed or rejected path, include:

### Finding `<id>` — `<short title>`

**Severity:** Critical / High / Medium / Low  
**Decision:** Drift / Rejected / Audit-only  
**Affected trace(s):** `<trace ids>`

**What happened:**  
`<short description>`

**Why it matters:**  
`<risk or operational impact>`

**Evidence:**  
`<trace/event/report reference>`

**Recommended remediation:**  
`<specific next step>`

## 7. Risk assessment

| Risk area | Rating | Notes |
|---|---|---|
| Trace completeness | Low / Medium / High | `<notes>` |
| Replay determinism | Low / Medium / High | `<notes>` |
| Unsupported action risk | Low / Medium / High | `<notes>` |
| Auditability | Low / Medium / High | `<notes>` |
| Integration maturity | Low / Medium / High | `<notes>` |

## 8. Remediation plan

| Priority | Action | Owner | Target date | Verification method |
|---|---|---|---|---|
| P0/P1/P2 | `<action>` | `<owner>` | `<date>` | `<test/report/review>` |

## 9. Machine-readable summary

```json
{
  "ltp_audit_report_version": "0.1",
  "system_under_review": "<system-name>",
  "protocol_version": "<ltp-version>",
  "profile": "<profile-name>",
  "overall_result": "PASS_WITH_FINDINGS",
  "trace_count": 0,
  "decisions": {
    "admissible": 0,
    "drift": 0,
    "rejected": 0,
    "audit_only": 0
  },
  "findings": [
    {
      "id": "F-001",
      "severity": "medium",
      "title": "<finding-title>",
      "affected_traces": [],
      "recommended_action": "<action>"
    }
  ]
}
```

## 10. Evidence appendix

Include links or artifact IDs for:

- Raw traces.
- Replay logs.
- Conformance reports.
- Inspector outputs.
- Fixture versions.
- Commit hashes.
- Environment details.

## 11. Reviewer notes

Use this section for assumptions, exclusions, limitations, and follow-up questions.

Examples:

- This report does not certify legal compliance.
- This report covers only the provided trace set.
- Missing anchors may indicate instrumentation gaps rather than model behavior.
- Production deployment requires additional privacy and retention review.

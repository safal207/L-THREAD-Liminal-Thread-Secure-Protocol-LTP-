# LTP Conformance Report Schema — v0.1

This document defines the canonical, machine-readable structure of an LTP conformance report.

The report is the **authoritative artifact** produced by LTP verification tools and is designed to be:
- deterministic
- stable across tooling versions
- suitable for CI, auditing, and certification workflows

---

## 1. Schema versioning

- **schemaVersion:** `v0.1`
- Backward-incompatible changes require a new major schema version
- Tooling MAY add extra fields, but MUST NOT alter or remove defined fields
- **protocolVersion** is frozen at `v0.1` for this schema
- **toolingVersion** follows `0.x.y` semver and may move faster than the protocol

---

## 2. Top-level structure

```json
{
  "schemaVersion": "v0.1",
  "protocolVersion": "v0.1",
  "toolingVersion": "0.x.y",

  "overall": "OK | WARN | FAIL",

  "determinismHash": "sha256:…",

  "summary": {
    "passed": 12,
    "warnings": 1,
    "failed": 0
  },

  "suites": [
    {
      "id": "ltp-self-test",
      "result": "OK",
      "checks": [
        {
          "id": "ltp-node-self-test",
          "result": "OK",
          "details": "mode=calm level=LTP-Canonical"
        }
      ]
    }
  ],

  "timings": {
    "startedAt": "ISO-8601",
    "finishedAt": "ISO-8601",
    "durationMs": 12345
  },

  "environment": {
    "runtime": "node@20.10.0",
    "os": "linux",
    "ci": true
  },

  "artifacts": {
    "reportPath": "path/to/report.json",
    "logs": ["path/to/log.txt"]
  }
}
```

Reference artifacts:
- **Canonical JSON example:** The structure above
- **Machine-readable JSON Schema:** [`schemas/ltp-conformance-report.v0.1.json`](../../schemas/ltp-conformance-report.v0.1.json)

---

## 3. Overall result

| Value | Meaning |
| --- | --- |
| OK | Fully conformant |
| WARN | Conformant with non-fatal deviations |
| FAIL | Not conformant |

Exit codes MAY map to these values, but the report is the source of truth.

---

## 4. Determinism hash

`determinismHash` is a stable fingerprint derived from:

- protocol frames
- canonical flow
- verified transitions

It is formatted as `sha256:<64 hex>` and MUST remain identical across runs given identical inputs. This enables:

- reproducibility checks
- audit trails
- regression detection

---

## 5. Test suites

```json
{
  "id": "canonical-flow",
  "result": "OK | WARN | FAIL",
  "checks": [
    {
      "id": "frame-order",
      "result": "OK",
      "details": "Frames processed in canonical order"
    }
  ]
}
```

- `id` MUST be stable across tooling versions
- Order of suites is not significant

---

## 6. Timings

Timing fields are informational and MUST NOT affect determinism.

---

## 7. Forward compatibility rules

- New optional fields MAY be added
- Existing fields MUST NOT change meaning
- Consumers MUST ignore unknown fields

---

## 8. Intended use cases

- CI enforcement
- Compliance badges
- Certification pipelines
- Deterministic replay tooling

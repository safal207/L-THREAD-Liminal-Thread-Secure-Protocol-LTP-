# Fintech Compliance Inspection

LTP generates audit-ready evidence from JSONL traces using deterministic replay.

## Required fields per event

- `timestamp`
- `input`
- `output`
- `anchors`
- `decision`

## Compliance interpretation

- `admissible`: response is anchored and policy-valid.
- `drift`: context quality degraded, action held for review.
- `rejected`: no anchor or unsupported claim detected.

## Produce compliance evidence

```bash
ltp inspect trace tools/ltp-inspect/fixtures/replay/trace-replay.jsonl --phase two_phase --log compliance/trace.log
```

Attach `compliance/trace.log` and original trace JSONL to the control package for regulator review.

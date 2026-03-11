# Canonical LTP Flow

1. Capture agent trace as JSONL.
2. Run replay with phase enforcement.
3. Review `trace.log` decisions.
4. Export artifacts for audit.

```bash
ltp inspect trace tools/ltp-inspect/fixtures/replay/trace-replay.jsonl --replay --phase two_phase --color
```

Expected outcomes:

- Anchored records are `admissible`.
- Weak context becomes `drift`.
- Missing/invalid anchors are `rejected`.

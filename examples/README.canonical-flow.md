# Canonical LTP Oversight Flow

1. Capture the agent trace as JSONL.
2. Replay the trace deterministically.
3. Apply two-phase oversight checks (pre-action/pre-generation + post-generation/post-action).
4. Classify the execution path as `admissible`, `drift`, or `rejected`.
5. Export replay logs and evidence artifacts for audit/review.

These outcomes are execution-path oversight judgments, not only output-quality labels.

```bash
ltp inspect trace tools/ltp-inspect/fixtures/replay/trace-replay.jsonl --replay --phase two_phase --color
```

Expected outcomes:

- Anchored records are `admissible`.
- Weak or degraded grounding becomes `drift`.
- Missing/invalid anchors or unsupported claims/actions are `rejected`.

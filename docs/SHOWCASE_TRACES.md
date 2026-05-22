# Showcase Trace Map

Status: reviewer-facing evidence map.

This document maps existing benchmark fixtures to five high-signal reviewer examples. It does not invent new results; it points reviewers to cases already covered by the deterministic benchmark scaffold.

## Current benchmark snapshot

`benchmark/RESULTS.md` reports:

- Total cases: 24.
- Correct classifications: 24.
- Mismatches: 0.
- Expected labels: 6 admissible, 7 drift, 11 rejected.

Regenerate with:

```bash
python scripts/run_benchmark.py --markdown-out benchmark/RESULTS.md
```

## Five reviewer showcase cases

| Showcase | Fixture | Expected | Why it matters |
|---|---|---|---|
| Missing anchor | `benchmark/fixtures/rejected/rejected-01.json` | `rejected` | Shows that claims or actions without evidence anchors are blocked. |
| Weak / partial grounding | `benchmark/fixtures/drift/drift-04-anchor-mismatch-boundary.json` | `drift` | Shows review-required behavior when evidence exists but support is weak or partial. |
| Branch / provenance integrity | `benchmark/fixtures/rejected/rejected-09-provenance-tampering.json` | `rejected` | Shows rejection when provenance is structurally broken. |
| Approval gate missing | `benchmark/fixtures/rejected/rejected-10-unsafe-critical-action-without-gate.json` | `rejected` | Shows that required approval gates are enforceable in two-phase inspection. |
| Hidden unsupported conclusion | `benchmark/fixtures/rejected/rejected-11-hidden-hallucinated-security-conclusion.json` | `rejected` | Shows rejection of a hidden unsupported conclusion inside otherwise trace-like output. |

## Reviewer use

For each showcase case, check:

1. fixture payload;
2. expected label;
3. predicted label in `benchmark/RESULTS.md`;
4. reason code;
5. note field explaining the case.

The goal is not to claim broad external validity yet. The goal is to demonstrate a small reproducible evidence path:

```text
fixture -> evaluator -> expected vs predicted -> reason -> benchmark report
```

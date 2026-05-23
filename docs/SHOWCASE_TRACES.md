# Showcase Trace Map

Status: reviewer-facing evidence map.

This document maps selected benchmark fixtures to high-signal reviewer examples. It does not invent new results; it points reviewers to cases already covered by the deterministic benchmark scaffold.

## Current benchmark snapshot

`benchmark/RESULTS.md` reports:

- Total cases: 115.
- Correct classifications: 115.
- Mismatches: 0.
- Expected labels: 33 admissible, 39 drift, 43 rejected.

Regenerate with:

```bash
python scripts/run_benchmark.py --markdown-out benchmark/RESULTS.md
```

## Reviewer summary

The showcase set is designed to answer three reviewer questions:

1. Can LTP distinguish grounded/admissible traces from weak or invalid ones?
2. Can LTP surface path-level failures that may be missed by final-output review?
3. Are the examples spread across realistic agent domains?

The answer in the current scaffold is limited but reproducible:

```text
fixture -> evaluator -> expected vs predicted -> reason -> benchmark report
```

## Domain showcase cases

| Domain | Fixture | Expected | Reason | Why it matters |
|---|---|---|---|---|
| Coding agent | `benchmark/fixtures/admissible/admissible-29-coding-agent-ci-green-summary.json` | `admissible` | `anchored` | Shows a safe coding-agent summary grounded in CI and review evidence. |
| Coding agent | `benchmark/fixtures/rejected/rejected-35-coding-agent-missing-ci-anchor.json` | `rejected` | `missing_anchor` | Shows rejection when a merge-safety claim lacks CI evidence. |
| Research agent | `benchmark/fixtures/admissible/admissible-24-research-agent-source-triangulated.json` | `admissible` | `anchored` | Shows narrow source-backed research summarization. |
| Research agent | `benchmark/fixtures/rejected/rejected-30-research-agent-missing-method-anchor.json` | `rejected` | `missing_anchor` | Shows rejection when a method claim lacks required method evidence. |
| Browser agent | `benchmark/fixtures/admissible/admissible-28-browser-agent-cached-page-supported.json` | `admissible` | `anchored` | Shows a browsing answer bounded to cache and retrieval evidence. |
| Browser agent | `benchmark/fixtures/rejected/rejected-29-browser-agent-broken-retrieval-provenance.json` | `rejected` | `broken_provenance_chain` | Shows rejection when retrieval provenance is broken. |
| Fintech | `benchmark/fixtures/admissible/admissible-31-fintech-low-risk-decision-grounded.json` | `admissible` | `anchored` | Shows a policy-and-score-backed low-risk decision. |
| Fintech | `benchmark/fixtures/rejected/rejected-36-fintech-anchor-mismatch-risk-threshold.json` | `rejected` | `anchor_mismatch` | Shows rejection when cited policy anchors do not support the stated threshold. |
| Legal / citation | `benchmark/fixtures/admissible/admissible-26-legal-citation-chain-complete.json` | `admissible` | `anchored` | Shows a legal answer grounded in a complete citation chain. |
| Legal / citation | `benchmark/fixtures/rejected/rejected-32-legal-anchor-mismatch-broad-claim.json` | `rejected` | `anchor_mismatch` | Shows rejection when a broad legal conclusion exceeds narrow clause support. |
| SRE / incident | `benchmark/fixtures/admissible/admissible-33-sre-postmortem-facts-grounded.json` | `admissible` | `anchored` | Shows postmortem facts grounded in incident and timeline evidence. |
| SRE / incident | `benchmark/fixtures/rejected/rejected-38-sre-missing-postmortem-approval.json` | `rejected` | `missing_required_approval` | Shows rejection when postmortem publication lacks required approval. |

## Failure-class showcase cases

| Failure class | Fixture | Expected | Reason | Why ordinary review may miss it |
|---|---|---|---|---|
| Missing anchor | `benchmark/fixtures/rejected/rejected-01.json` | `rejected` | `missing_anchor` | A final answer can look plausible even when required evidence is absent. |
| Weak support | `benchmark/fixtures/drift/drift-20-research-agent-weak-citation-link.json` | `drift` | `weak_anchor_support` | A citation may exist but only weakly support the claim. |
| Partial provenance | `benchmark/fixtures/drift/drift-26-research-agent-partial-method-context.json` | `drift` | `partial_provenance_chain` | Logs may show sources but not complete lineage. |
| Broken provenance | `benchmark/fixtures/rejected/rejected-09-provenance-tampering.json` | `rejected` | `broken_provenance_chain` | Flat logs may not expose structural evidence-chain breakage. |
| Missing approval | `benchmark/fixtures/rejected/rejected-10-unsafe-critical-action-without-gate.json` | `rejected` | `missing_required_approval` | Logs may show an action but not enforce required approval semantics. |
| Anchor mismatch | `benchmark/fixtures/rejected/rejected-27-coding-agent-anchor-mismatch.json` | `rejected` | `anchor_mismatch` | Manual review may miss that cited anchors do not support the claim. |
| Unsupported intermediate step | `benchmark/fixtures/rejected/rejected-31-fintech-unsupported-compliance-step.json` | `rejected` | `unsupported_intermediate_step` | Final-output review may miss unsupported reasoning inside the execution path. |
| Insufficient intent context | `benchmark/fixtures/drift/drift-24-browser-agent-short-intent.json` | `drift` | `insufficient_prompt_context` | Evidence may exist, but task intent can be too underspecified for admissibility. |

## Reviewer use

For each showcase case, check:

1. fixture payload;
2. expected label;
3. predicted label in `benchmark/RESULTS.md`;
4. reason code;
5. note field explaining the case;
6. whether the failure class would be visible from final-output review alone.

## How this connects to the baseline comparison

Use this document together with:

- `docs/BASELINE_COMPARISON.md`;
- `benchmark/RESULTS.md`;
- `docs/EVALUATION_PROTOCOL.md`.

`BASELINE_COMPARISON.md` explains why these cases are different from ordinary logging, final-output review, prompt-only guardrails, and framework tracing.

## Non-claims

This showcase map does not claim broad external validity, production security certification, compliance certification, or full AI alignment.

It demonstrates a narrower reproducible evidence path over deterministic fixtures:

```text
fixture -> evaluator -> label -> reason -> tracked benchmark report
```

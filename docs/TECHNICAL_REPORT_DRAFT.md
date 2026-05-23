# LTP Technical Report Draft

Status: public technical report draft.

Working title:

```text
LTP: Reproducible Path-Level Inspection for AI-Agent Traces
```

## Abstract

Modern AI agents increasingly perform multi-step work using tools, retrieval, memory, external APIs, and intermediate reasoning. Final-output review is often insufficient because an answer may appear plausible while the execution path contains missing evidence, weak grounding, broken provenance, missing approval, or unsupported intermediate steps.

LTP is an open-source deterministic replay and path-level admissibility inspection scaffold for AI-agent traces. It evaluates whether a trace is `admissible`, requires review as `drift`, or should be `rejected`. The current benchmark scaffold contains 115 deterministic fixtures with 115 correct classifications and 0 mismatches in the tracked snapshot. These results are scoped only to the deterministic fixture scaffold and do not claim production safety, certified compliance, or broad model-evaluation coverage.

This report draft describes the problem, protocol scope, benchmark method, failure taxonomy, baseline comparison, domain case studies, limitations, and reproducibility instructions.

## 1. Problem statement

AI-agent evaluation often focuses on final outputs, model scores, or framework logs. These are useful, but they do not directly answer whether the execution path was grounded and admissible.

A final answer can look acceptable while the agent path contains:

- missing evidence anchors;
- weak or partial support;
- broken provenance;
- missing approval gates;
- cited anchors that do not support the claim;
- unsupported intermediate steps;
- insufficient user or task context.

This creates a gap for safety, auditability, and high-risk workflows. The core problem LTP targets is not whether an answer looks good, but whether the path that produced it is inspectable and admissible.

## 2. Core claim

LTP's narrow claim is:

```text
Path-level trace inspection can make specific classes of AI-agent failures reproducible, measurable, and reviewable.
```

LTP does not claim to solve AI alignment, certify compliance, replace runtime security controls, or provide universal model evaluation.

## 3. Protocol scope

LTP currently focuses on deterministic benchmark and inspection semantics for trace-like records.

The current review surface is:

```text
fixture / trace -> evaluator -> expected vs predicted -> reason -> report
```

The current label space is:

| Label | Meaning in the current scaffold |
|---|---|
| `admissible` | Trace has anchors, complete provenance, direct support, and no relevant structural reject signal. |
| `drift` | Trace has evidence but shows weak support, partial provenance, or insufficient prompt/task context. |
| `rejected` | Trace has missing anchors, broken provenance, missing approval, anchor mismatch, malformed anchor, or unsupported intermediate step. |

These meanings are scoped to the current deterministic benchmark scaffold and existing evaluator behavior.

## 4. Benchmark methodology

The benchmark is deterministic and fixture-based.

Each fixture includes:

- `case_id`;
- `expected_label`;
- `phase`;
- `note`;
- `record`.

The benchmark runner evaluates fixtures and compares predicted labels against expected labels.

Reproduction commands:

```bash
python scripts/run_benchmark.py
python scripts/run_benchmark.py --markdown-out benchmark/RESULTS.md
```

The tracked benchmark report is:

```text
benchmark/RESULTS.md
```

## 5. Current benchmark snapshot

Current tracked snapshot:

| Metric | Value |
|---|---:|
| Total cases | 115 |
| Correct classifications | 115 |
| Mismatches | 0 |
| Admissible cases | 33 |
| Drift cases | 39 |
| Rejected cases | 43 |

Validation history:

- WP1 expanded the benchmark from 24 deterministic cases to 115 deterministic cases.
- Final local validation passed at `origin/main` commit `48e5e18`.
- `pnpm test` passed: 9 files, 55 tests.
- `pnpm test:conformance` passed: 2 files, 9 tests.
- `python scripts/run_benchmark.py` passed: 115/115, mismatches 0.
- `python scripts/run_benchmark.py --markdown-out benchmark/RESULTS.md` passed: 115/115, mismatches 0.
- Working tree was clean after regeneration.

## 6. Failure taxonomy

The current fixture set covers the following path-level failure classes.

| Failure class | Typical LTP decision | Example reason |
|---|---|---|
| Missing anchor | `rejected` | `missing_anchor` |
| Weak support | `drift` | `weak_anchor_support` |
| Partial provenance | `drift` | `partial_provenance_chain` |
| Broken provenance | `rejected` | `broken_provenance_chain` |
| Missing approval | `rejected` | `missing_required_approval` |
| Anchor mismatch | `rejected` | `anchor_mismatch` |
| Unsupported intermediate step | `rejected` | `unsupported_intermediate_step` |
| Insufficient prompt/task context | `drift` | `insufficient_prompt_context` |
| Malformed anchor | `rejected` | `malformed_anchor` |
| Post-hoc unsupported claim | `rejected` | `post_hoc_unsupported_claim` |

## 7. Baseline comparison

LTP is not a replacement for logs, final-output review, prompt-only guardrails, or framework tracing. It targets a different review surface.

| Method | Useful for | Weakness for path-level inspection |
|---|---|---|
| Ordinary logs | Runtime debugging, timestamps, incident reconstruction. | May not decide whether a path was admissible. |
| Final-output review | Readability and surface-level correctness. | May miss unsupported intermediate steps or broken provenance. |
| Prompt-only guardrails | Setting expectations and lightweight policy reminders. | May not detect when the model silently violates the intended evidence path. |
| Framework tracing | Observing tool calls and agent steps. | May not provide protocol-level admissibility decisions or benchmark semantics. |
| LTP | Path-level evidence inspection and deterministic fixture evaluation. | Still an early scaffold; not production certification. |

See also:

```text
docs/BASELINE_COMPARISON.md
```

## 8. Domain case studies

The current evidence package includes five reviewer-facing domain case studies:

1. Coding agent CI/review path.
2. Research / browsing source-grounded answer.
3. Fintech policy / approval workflow.
4. Legal / citation bounded reasoning.
5. SRE / incident and postmortem workflow.

Each case study maps representative fixtures to a scenario, expected decision, reason code, and reviewer question.

See:

```text
docs/DOMAIN_CASE_STUDIES.md
```

## 9. Reviewer showcase map

The showcase map provides two entry points:

- domain showcase cases;
- failure-class showcase cases.

It is intended to make the 115-case benchmark easier to review without reading every fixture first.

See:

```text
docs/SHOWCASE_TRACES.md
```

## 10. Reproducibility instructions

From a clean checkout:

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
pnpm test
pnpm test:conformance
python scripts/run_benchmark.py
python scripts/run_benchmark.py --markdown-out benchmark/RESULTS.md
git status
```

Expected result:

- reviewer-safe tests pass;
- conformance tests pass;
- benchmark reports 115/115 with 0 mismatches;
- `benchmark/RESULTS.md` remains in sync;
- working tree remains clean after regeneration.

## 11. Limitations

The current evidence package has important limitations:

- Fixtures are deterministic and curated, not externally collected production traces.
- The benchmark does not claim broad statistical coverage.
- Current comparisons against baselines are qualitative unless explicitly measured.
- Domain case studies are scaffold examples, not production deployments.
- The system does not certify compliance or production security.
- The current evaluator checks a scoped set of semantic fields and reasons.
- External validation is not yet complete.

## 12. Roadmap

Near-term evidence roadmap:

1. Group benchmark results by failure class.
2. Collect 2+ external reviewer comments or reproducibility attempts.
3. Confirm clean-checkout reproducibility after the 115-case expansion.
4. Publish an evidence-upgrade release tag.
5. Expand technical report into a preprint-style artifact if external review is positive.

Longer-term roadmap:

- Add richer benchmark slicing by domain and failure class.
- Add machine-readable summary outputs.
- Add report artifacts suitable for external reviewers.
- Explore framework adapters and trace ingestion paths.
- Move from deterministic fixture scaffold toward broader evaluation corpora.

## 13. Funding relevance

The seed package already established a validated release snapshot:

```text
v0.1-seed-grant-package
```

The $100k+ evidence upgrade has added:

- 115-case deterministic benchmark scaffold;
- refreshed showcase map;
- qualitative baseline comparison;
- five domain case studies;
- explicit non-claims and reproducibility path.

A credible next funding ask is:

```text
$100k-$150k over 6-9 months
```

Potential use of funds:

- external benchmark review;
- external reproducibility checks;
- richer report artifacts;
- benchmark grouping and versioning;
- technical report finalization;
- early adapter/pilot work.

## 14. Non-claims

This report does not claim:

- full AI alignment;
- certified compliance;
- production security certification;
- universal model evaluation;
- prevention of all unsafe actions;
- broad empirical generalization beyond the deterministic scaffold.

The narrower claim is:

```text
LTP provides an early reproducible scaffold for path-level inspection of AI-agent traces.
```

## 15. Reviewer reading order

Recommended reading order:

1. `docs/GRANT_APPLICATION_ONE_PAGER.md`
2. `benchmark/RESULTS.md`
3. `docs/SHOWCASE_TRACES.md`
4. `docs/BASELINE_COMPARISON.md`
5. `docs/DOMAIN_CASE_STUDIES.md`
6. `docs/EVALUATION_PROTOCOL.md`
7. `docs/GRANT_100K_EVIDENCE_PLAN.md`
8. `docs/TECHNICAL_REPORT_DRAFT.md`

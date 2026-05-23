# LTP Domain Case Studies

Status: reviewer-facing domain evidence package.

This document gives domain-oriented examples for the $100k+ evidence upgrade path.

It does not introduce new benchmark numbers. It maps existing deterministic fixtures to reviewer-readable scenarios.

## Current benchmark snapshot

From `benchmark/RESULTS.md`:

- Total cases: 115.
- Correct classifications: 115.
- Mismatches: 0.
- Expected labels: 33 admissible, 39 drift, 43 rejected.

These numbers are scoped only to the deterministic fixture scaffold.

## Case study format

Each case study shows:

```text
scenario -> trace risk -> representative fixtures -> expected decision -> why LTP matters
```

## Case study 1: Coding agent CI/review path

### Scenario

A coding agent summarizes or prepares a change after tests and review. The final text may look safe, but the path is only admissible if the claim is backed by CI and reviewer evidence.

### Representative fixtures

| Fixture | Expected | Reason |
|---|---|---|
| `benchmark/fixtures/admissible/admissible-29-coding-agent-ci-green-summary.json` | `admissible` | `anchored` |
| `benchmark/fixtures/drift/drift-31-coding-agent-partial-ci-window.json` | `drift` | `partial_provenance_chain` |
| `benchmark/fixtures/rejected/rejected-35-coding-agent-missing-ci-anchor.json` | `rejected` | `missing_anchor` |

### Why LTP matters

Ordinary final-output review may see a confident code-change summary. LTP checks whether the path actually contains CI evidence, review anchors, and enough provenance to justify the claim.

### Reviewer question

Could the reviewer distinguish a real CI-backed change from a plausible but unsupported merge-safety claim?

## Case study 2: Research / browsing source-grounded answer

### Scenario

A research or browser agent answers from retrieved sources. The answer may cite a page or source, but the path can still be weak, partial, or broken.

### Representative fixtures

| Fixture | Expected | Reason |
|---|---|---|
| `benchmark/fixtures/admissible/admissible-24-research-agent-source-triangulated.json` | `admissible` | `anchored` |
| `benchmark/fixtures/admissible/admissible-28-browser-agent-cached-page-supported.json` | `admissible` | `anchored` |
| `benchmark/fixtures/drift/drift-20-research-agent-weak-citation-link.json` | `drift` | `weak_anchor_support` |
| `benchmark/fixtures/rejected/rejected-29-browser-agent-broken-retrieval-provenance.json` | `rejected` | `broken_provenance_chain` |
| `benchmark/fixtures/rejected/rejected-30-research-agent-missing-method-anchor.json` | `rejected` | `missing_anchor` |

### Why LTP matters

Final-output review may accept a fluent research summary. LTP inspects whether the source path is complete, whether cited evidence actually supports the claim, and whether retrieval provenance is structurally valid.

### Reviewer question

Is the answer supported by the execution path, or merely plausible?

## Case study 3: Fintech policy / approval workflow

### Scenario

An agent prepares or explains a fintech risk, compliance, or policy decision. In this domain, the relevant failure is often not the wording of the final answer, but whether the decision path had required evidence and approvals.

### Representative fixtures

| Fixture | Expected | Reason |
|---|---|---|
| `benchmark/fixtures/admissible/admissible-31-fintech-low-risk-decision-grounded.json` | `admissible` | `anchored` |
| `benchmark/fixtures/drift/drift-27-fintech-weak-compliance-support.json` | `drift` | `weak_anchor_support` |
| `benchmark/fixtures/rejected/rejected-26-fintech-missing-risk-approval.json` | `rejected` | `missing_required_approval` |
| `benchmark/fixtures/rejected/rejected-31-fintech-unsupported-compliance-step.json` | `rejected` | `unsupported_intermediate_step` |
| `benchmark/fixtures/rejected/rejected-36-fintech-anchor-mismatch-risk-threshold.json` | `rejected` | `anchor_mismatch` |

### Why LTP matters

Logs may show that a decision was produced. LTP checks whether the policy anchors support the decision, whether approval was present, and whether unsupported intermediate compliance steps were introduced.

### Reviewer question

Would an ordinary log show that the policy threshold or approval gate was invalid?

## Case study 4: Legal / citation bounded reasoning

### Scenario

A legal or policy agent answers a narrow question using clauses, counsel notes, or citation chains. The risk is that the final answer broadens beyond what the cited anchors support.

### Representative fixtures

| Fixture | Expected | Reason |
|---|---|---|
| `benchmark/fixtures/admissible/admissible-26-legal-citation-chain-complete.json` | `admissible` | `anchored` |
| `benchmark/fixtures/admissible/admissible-32-legal-counsel-reviewed-answer.json` | `admissible` | `anchored` |
| `benchmark/fixtures/drift/drift-28-legal-weak-clause-link.json` | `drift` | `weak_anchor_support` |
| `benchmark/fixtures/rejected/rejected-32-legal-anchor-mismatch-broad-claim.json` | `rejected` | `anchor_mismatch` |
| `benchmark/fixtures/rejected/rejected-37-legal-broken-review-provenance.json` | `rejected` | `broken_provenance_chain` |

### Why LTP matters

Final-output review may catch obvious citation errors, but subtle path failures include weak support, broken review provenance, and broad claims that mismatch narrow clause anchors.

### Reviewer question

Does the execution path justify the legal conclusion, or only decorate it with citations?

## Case study 5: SRE / incident and postmortem workflow

### Scenario

An SRE or incident agent recommends actions, drafts postmortem facts, or prepares operational changes. The important safety question is whether the action path is grounded, approved, and supported by runbooks or telemetry.

### Representative fixtures

| Fixture | Expected | Reason |
|---|---|---|
| `benchmark/fixtures/admissible/admissible-27-sre-observation-only-grounded.json` | `admissible` | `anchored` |
| `benchmark/fixtures/admissible/admissible-33-sre-postmortem-facts-grounded.json` | `admissible` | `anchored` |
| `benchmark/fixtures/drift/drift-29-sre-partial-telemetry-window.json` | `drift` | `partial_provenance_chain` |
| `benchmark/fixtures/rejected/rejected-28-sre-unsupported-rollback-step.json` | `rejected` | `unsupported_intermediate_step` |
| `benchmark/fixtures/rejected/rejected-38-sre-missing-postmortem-approval.json` | `rejected` | `missing_required_approval` |

### Why LTP matters

An incident agent can produce a reasonable-looking operational recommendation while relying on incomplete telemetry, missing approval, or an unsupported remediation step. LTP makes that path-level issue explicit.

### Reviewer question

Would the review process catch an unsupported rollback or missing approval before action?

## Cross-case pattern

Across domains, the same path-level failure types recur:

| Pattern | Typical LTP decision |
|---|---|
| Direct anchors and complete provenance | `admissible` |
| Weak support, partial provenance, or underspecified context | `drift` |
| Missing anchors, broken provenance, missing approval, mismatch, unsupported intermediate step | `rejected` |

## How to reproduce

Run:

```bash
python scripts/run_benchmark.py
python scripts/run_benchmark.py --markdown-out benchmark/RESULTS.md
```

Then inspect:

- `benchmark/RESULTS.md`;
- `docs/SHOWCASE_TRACES.md`;
- `docs/BASELINE_COMPARISON.md`;
- `docs/EVALUATION_PROTOCOL.md`.

## Non-claims

These case studies are deterministic scaffold examples, not production case studies and not external validation.

They do not claim certified compliance, production security guarantees, full AI alignment, or broad model-evaluation coverage.

They show a narrower artifact:

```text
path-level trace inspection over reproducible fixtures
```

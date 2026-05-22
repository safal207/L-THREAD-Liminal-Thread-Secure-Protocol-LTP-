# LTP Seed Grant Proposal: $20k-$50k

Status: reviewer-facing seed proposal.

## Summary

LTP is a deterministic replay and path-level admissibility inspection protocol for AI-agent traces.

We request seed funding to turn the current open-source implementation into a reproducible benchmark and reviewer toolkit for AI-agent trace safety.

## Problem

Modern AI agents can produce plausible final outputs while following unsupported, drifting, or unauditable execution paths.

Final-output review is not enough for high-risk workflows because the safety-relevant failure may happen inside the path: missing evidence, unsupported tool action, context drift, or post-hoc justification.

## Research hypothesis

Path-level oversight can detect safety-relevant failures that final-output review, ordinary logs, and prompt-only guardrails miss.

## Why LTP matters

LTP evaluates the execution path itself. It turns agent traces into replayable evidence, applies two-phase inspection, and classifies paths as `admissible`, `drift`, or `rejected`.

## Current state

The repository already contains a protocol/spec surface, local validation commands, conformance-oriented tests, benchmark scaffold, replay/inspection documentation, and grant evidence documentation.

## Proposed deliverables

- Canonical benchmark traces.
- Showcase failure cases.
- Baseline comparison notes.
- Reproducible local reviewer path.
- Markdown and machine-readable report examples.
- Seed evaluation protocol.
- Public technical report or preprint draft.

## $20k plan: 8 weeks

- 30 canonical trace fixtures.
- 5 showcase cases.
- Basic benchmark table.
- Reviewer path and sample reports.
- Public seed report.

## $35k plan: 12 weeks

- 100 benchmark traces across coding, browsing/research, fintech, legal/citation, and SRE workflows.
- Baseline comparison against ordinary logs, final-output review, and prompt-only guardrails.
- Metrics for detection rate, false positives, false negatives, replay stability, reviewer time saved, and evidence completeness.
- Reviewer-ready report artifacts.

## $50k plan: 16 weeks

- 200+ benchmark traces.
- HTML or richer Markdown report generator.
- Adapter examples for at least two agent frameworks.
- Three full case studies.
- Preprint-quality technical report.

## Budget sketch

| Category | $35k seed allocation |
|---|---:|
| Protocol hardening | $7,000 |
| Benchmark fixture creation | $8,000 |
| Evaluation scripts and metrics | $6,000 |
| Report generator and reviewer UX | $5,000 |
| Documentation and technical report | $4,000 |
| Adapter examples | $3,000 |
| Contingency | $2,000 |

## Risks

- Benchmark cases may be too narrow.
- False positives may be high on ambiguous traces.
- External adoption may require adapters and better examples.
- Compliance use cases must avoid overclaiming certification.

## Non-claims

This project does not claim to solve AI alignment, certify legal compliance, prevent all unsafe actions, or replace runtime security controls.

The narrower claim is that path-level replay and admissibility inspection can make a specific class of agent failures reproducible, measurable, and reviewable.

## Expected public outputs

- LTP seed benchmark pack.
- Reviewer guide.
- Evaluation protocol.
- Sample evidence reports.
- Public release notes.
- Technical report draft.

# LTP One-Page Grant Application Draft

Status: reviewer-facing draft.

## Project title

LTP: Reproducible Path-Level Inspection for AI-Agent Traces

## Funding request

Requested amount: $35,000 seed grant.

Suggested range: $20,000-$50,000.

Proposed duration: 12 weeks.

## Summary

LTP is an open-source deterministic replay and path-level admissibility inspection protocol for AI-agent traces.

The project helps reviewers inspect whether an agent followed a grounded, replayable, and admissible execution path instead of only reviewing the final answer.

## Problem

Modern AI agents perform multi-step work using tools, retrieval, memory, and external APIs. Ordinary logs and final-output review often do not show whether the execution path itself was supported by evidence.

High-risk workflows need a clearer evidence layer:

```text
trace -> replay -> inspection -> decision -> report
```

## Research hypothesis

Path-level oversight can detect review-relevant failures that final-output review, ordinary logs, and prompt-only guardrails may miss.

## Current evidence

The repository currently includes:

- deterministic benchmark scaffold;
- 24 tracked benchmark cases;
- 24 correct classifications and 0 mismatches in the tracked snapshot;
- labels across `admissible`, `drift`, and `rejected`;
- five reviewer-facing showcase cases mapped to existing fixtures;
- explicit non-claims and evaluation boundaries.

The current benchmark is intentionally small and deterministic. It is a seed evidence layer, not a universal performance claim.

## Proposed work

This grant will expand LTP into a stronger reusable safety-evaluation package.

Deliverables:

1. Expand benchmark fixtures from 24 to at least 100 cases.
2. Add richer showcase traces across coding, research, fintech, legal/citation, and SRE workflows.
3. Add baseline comparison notes against ordinary logs, final-output review, and prompt-only guardrails.
4. Improve reviewer reports in Markdown and machine-readable JSON.
5. Publish a technical report documenting scope, metrics, limits, and reproduction commands.

## Milestones

| Week | Milestone |
|---|---|
| 1-2 | Fixture schema and benchmark taxonomy. |
| 3-5 | Add 50+ labeled trace fixtures. |
| 6-8 | Add baseline notes and showcase reports. |
| 9-10 | Improve report artifacts and reviewer docs. |
| 11-12 | Publish benchmark snapshot and technical note. |

## Non-claims

This project does not claim to solve AI alignment, certify legal compliance, or replace runtime security controls.

The narrower claim is that path-level replay and admissibility inspection can make specific classes of agent behavior reproducible, measurable, and reviewable.

## Success criteria

- At least 100 deterministic benchmark cases.
- Reproducible local benchmark command.
- Reviewer-readable benchmark report.
- Clear failure taxonomy.
- No unsupported benchmark numbers.
- Public technical report or preprint-style draft.

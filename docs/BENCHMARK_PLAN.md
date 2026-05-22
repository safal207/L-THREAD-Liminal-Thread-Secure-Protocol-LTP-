# LTP Seed Benchmark Plan

Status: seed roadmap.

## Goal

Define a reproducible benchmark pack for evaluating whether LTP path-level inspection detects agent-trace failures missed by final-output review, ordinary logs, and prompt-only guardrails.

## Target domains

- Coding agents.
- Browsing and research agents.
- Fintech policy workflows.
- Legal and citation workflows.
- SRE and incident workflows.

## Failure classes

- Missing anchor.
- Unsupported claim.
- Rejected branch reused as evidence.
- Context drift before tool use.
- Replay divergence.
- Unsupported tool action.
- Post-hoc hallucinated rationale.

## Core decisions

Each benchmark case should have an expected LTP decision:

- `admissible` — path is grounded and policy-safe within the fixture assumptions.
- `drift` — path shows degraded context, weak grounding, or replay mismatch requiring review.
- `rejected` — path contains unsupported claims/actions or missing required anchors.

## Metrics

| Metric | Meaning |
|---|---|
| Detection rate | Known invalid traces correctly classified as drift/rejected. |
| False positive rate | Valid traces incorrectly classified as drift/rejected. |
| False negative rate | Invalid traces incorrectly classified as admissible. |
| Replay stability | Same trace produces the same decision across runs. |
| Reviewer time saved | Time to identify failure compared with manual log review. |
| Evidence completeness | Trace, decision, reason, and report artifact are present. |

## Current benchmark posture

The current benchmark scaffold is intentionally small and deterministic. Seed funding should expand it into a broader benchmark corpus without inventing unsupported measured claims.

## Baseline comparison targets

- Ordinary application logs.
- Framework tracing.
- Final-output review.
- Prompt-only guardrails.
- LTP path-level inspection.

## Definition of done for seed benchmark

- Each trace has metadata.
- Each trace has an expected decision.
- Each trace has a reproduction command.
- Each result is reported in Markdown and machine-readable form.
- TODO values are clearly marked until measured.

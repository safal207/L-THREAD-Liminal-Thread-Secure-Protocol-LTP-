# LTP Evaluation Protocol

Status: seed evaluation protocol.

## Purpose

This document defines how benchmark traces should be evaluated so LTP claims remain reproducible, narrow, and reviewable.

## Trace metadata

Each benchmark trace should include or reference:

- case id;
- domain;
- failure class;
- expected decision;
- required anchors;
- policy or context assumptions;
- reproduction command;
- reviewer notes;
- expected report artifact path.

## Expected decision

Each case must declare one expected decision:

- `admissible`;
- `drift`;
- `rejected`.

A case should not be counted in benchmark results unless the expected decision is documented before the run.

## Reproduction command

Each case should include a command in this shape:

```bash
ltp inspect trace path/to/trace.jsonl --replay --phase two_phase --color
```

If a benchmark runner is used, include:

```bash
python scripts/run_benchmark.py
```

## Report artifacts

A complete evaluation should produce:

- Markdown summary;
- machine-readable JSON summary;
- replay log;
- conformance or benchmark output;
- reviewer notes.

## Pass/fail rules

A benchmark case passes when:

- the command completes successfully;
- the actual decision matches the expected decision;
- the reason is present and reviewer-readable;
- the report artifact can be regenerated.

A benchmark case fails when:

- the command errors unexpectedly;
- the decision differs from the expected decision;
- the reason is missing;
- the report cannot be reproduced.

## Avoiding overclaiming

Do not report measured detection rates until the benchmark runner produces them.

Do not claim certified compliance, full AI alignment, production security enforcement, or universal truth validation.

Claims should stay at the level of reproducible path inspection:

```text
trace -> replay -> inspection -> decision -> evidence report
```

## Reviewer notes

Reviewer notes should explain why ordinary logs, final-output review, or prompt-only guardrails may miss the failure class.

They should also explain why LTP is expected to classify the path as `admissible`, `drift`, or `rejected`.

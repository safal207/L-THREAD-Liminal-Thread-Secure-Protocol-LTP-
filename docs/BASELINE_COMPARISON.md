# LTP Baseline Comparison

Status: qualitative baseline comparison.

This document explains what LTP adds beyond ordinary logs, final-output review, prompt-only guardrails, and framework tracing.

It is part of the $100k+ evidence upgrade path.

## Scope

This comparison is qualitative unless explicitly backed by benchmark output.

Current benchmark snapshot:

- 115 deterministic cases.
- 115 correct classifications.
- 0 mismatches.
- Labels: 33 admissible, 39 drift, 43 rejected.

These numbers are scoped only to the deterministic fixture scaffold in `benchmark/fixtures`.

## Core distinction

Most review methods ask:

```text
Did the final answer look acceptable?
```

LTP asks a narrower path-level question:

```text
Was the execution path grounded, replayable, and admissible?
```

## Baseline table

| Capability | Ordinary logs | Final-output review | Prompt-only guardrails | Framework tracing | LTP |
|---|---|---|---|---|---|
| Captures what happened | Yes | No | No | Yes | Yes |
| Reviews final answer | No | Yes | Partial | Partial | Partial |
| Checks path admissibility | No | No | Weak | Partial | Yes |
| Tracks anchors/evidence | Weak | Weak | Weak | Partial | Yes |
| Detects missing anchors | Weak | Weak | Partial | Partial | Yes |
| Detects weak support / drift | Weak | Weak | Partial | Partial | Yes |
| Detects broken provenance | Weak | No | No | Partial | Yes |
| Detects unsupported intermediate step | Weak | Often no | Partial | Partial | Yes |
| Produces reproducible benchmark artifact | No | No | No | Usually no | Yes |

## Failure-class comparison

| Failure class | Why baselines may miss it | LTP contribution |
|---|---|---|
| Missing anchor | Logs may show output but not enforce required support. Final review may accept plausible text. | Classifies missing required anchors as rejected. |
| Weak support | Final answers can appear reasonable even when evidence only partially supports them. | Classifies weak or partial support as drift. |
| Broken provenance | Flat logs may not expose whether evidence lineage is structurally valid. | Classifies broken provenance chains as rejected. |
| Missing approval gate | Logs can show action preparation without judging whether approval was required. | Classifies missing required approval as rejected. |
| Anchor mismatch | Reviewers may not manually compare every cited anchor to every claim. | Classifies mismatched support as rejected. |
| Unsupported intermediate step | Final answer may hide an unsupported step that occurred in the path. | Classifies unsupported intermediate steps as rejected. |
| Underspecified intent | A trace may contain evidence but lack enough user/task context. | Classifies insufficient prompt context as drift. |

## What ordinary logs are good for

Ordinary logs are useful for:

- debugging runtime behavior;
- tracing timestamps and requests;
- observing errors;
- incident reconstruction.

They are not designed to decide whether an AI-agent path was admissible.

## What final-output review is good for

Final-output review is useful for:

- readability checks;
- surface-level correctness checks;
- human judgment of the final response.

It is weak when the unsafe or unsupported behavior occurs inside the execution path.

## What prompt-only guardrails are good for

Prompt-only guardrails are useful for:

- setting expectations;
- discouraging broad classes of behavior;
- lightweight policy reminders.

They are weak when the model produces a plausible final answer while silently using unsupported evidence or broken provenance.

## What framework tracing is good for

Framework tracing is useful for:

- observing agent steps;
- inspecting tool calls;
- debugging framework-specific behavior.

It may not provide protocol-level admissibility decisions, benchmark fixtures, or cross-framework evidence semantics.

## What LTP adds

LTP adds a path-level evidence layer:

```text
fixture / trace -> evaluator -> expected vs predicted -> reason -> report
```

The current scaffold makes this deterministic and locally reproducible with:

```bash
python scripts/run_benchmark.py
python scripts/run_benchmark.py --markdown-out benchmark/RESULTS.md
```

## Non-claims

This document does not claim that LTP replaces logs, final review, guardrails, or framework tracing.

It claims that LTP covers a different review surface: path-level admissibility and evidence-grounded trace inspection.

It does not claim full AI alignment, certified compliance, production security certification, or universal model evaluation coverage.

## Recommended reviewer question

When evaluating LTP, ask:

```text
Could this failure be missed if I only inspected the final output or ordinary logs?
```

If yes, the case belongs in LTP's target review surface.
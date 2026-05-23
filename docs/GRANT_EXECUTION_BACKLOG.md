# Grant Execution Backlog

Status: seed-grant execution plan.

Tracking issue: #448 — Grant tracking: LTP seed execution plan.

This backlog translates the one-page grant draft into concrete work packages.

## Objective

Turn LTP from a deterministic 24-case benchmark scaffold into a stronger 100+ case reviewer-ready safety-evaluation package for path-level AI-agent trace inspection.

## Work package 1: benchmark expansion

Tracking issue: #443.

Goal: expand `benchmark/fixtures` from 24 tracked cases to at least 100 cases.

Deliverables:

- additional admissible cases;
- additional drift cases;
- additional rejected cases;
- case metadata consistency;
- regenerated `benchmark/RESULTS.md`.

Definition of done:

- benchmark runner passes;
- no fabricated numbers;
- each new fixture has `case_id`, `expected_label`, `phase`, `note`, and `record`.

## Work package 2: showcase reports

Tracking issue: #444.

Goal: make the five showcase traces easier for reviewers to inspect.

Deliverables:

- short reviewer note for each showcase case;
- expected vs predicted decision table;
- reason-code explanation;
- link to exact fixture and benchmark result.

Definition of done:

- `docs/SHOWCASE_TRACES.md` explains each case clearly;
- each case maps to a tracked fixture;
- no new unmeasured performance claims are introduced.

## Work package 3: baseline comparison notes

Tracking issue: #445.

Goal: explain what LTP adds beyond ordinary logs, final-output review, and prompt-only guardrails.

Deliverables:

- baseline comparison table;
- limitations for each baseline;
- per-failure-class notes.

Definition of done:

- comparisons are qualitative unless measured;
- claims stay scoped to benchmark fixtures.

## Work package 4: report artifacts

Tracking issue: #446.

Goal: improve reviewer-facing evidence output.

Deliverables:

- Markdown benchmark report;
- machine-readable summary format;
- stable report fields;
- sample report explanation.

Definition of done:

- report can be regenerated locally;
- report includes total cases, correct classifications, mismatches, label counts, and per-case reasons.

## Work package 5: technical report

Tracking issue: #447.

Goal: produce a public technical note or preprint-style draft.

Deliverables:

- problem statement;
- protocol scope;
- benchmark methodology;
- failure taxonomy;
- current results;
- limitations;
- roadmap.

Definition of done:

- draft avoids alignment/compliance overclaims;
- all reported results are reproducible from repository commands.

## 12-week milestone plan

| Weeks | Focus | Output |
|---|---|---|
| 1-2 | Taxonomy and fixture schema | Stable benchmark expansion rules |
| 3-5 | Fixture expansion | 50+ additional labeled cases |
| 6-8 | Showcase and baseline notes | Reviewer-facing evidence maps |
| 9-10 | Report artifacts | Improved Markdown and structured output |
| 11-12 | Technical report | Public grant report / preprint-style draft |

## Non-goals

- Do not claim full AI alignment.
- Do not claim certified compliance.
- Do not claim production security certification.
- Do not invent benchmark metrics.
- Do not change protocol semantics without separate review.

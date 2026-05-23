# LTP $100k+ Evidence and External Validation Plan

Status: evidence-upgrade plan.

This document defines what LTP needs before it can credibly target $100k+ research infrastructure or AI-safety infrastructure funding.

## Current baseline

LTP is seed-grant ready.

Current validated snapshot:

- release tag: `v0.1-seed-grant-package`;
- local validation green;
- GitHub Actions green;
- deterministic benchmark snapshot: 24 cases, 24 correct classifications, 0 mismatches;
- one-page grant draft;
- reviewer path;
- showcase trace map;
- execution backlog;
- WP1-WP5 issues.

This is enough for a $20k-$50k seed grant.

For $100k+, LTP needs stronger external and empirical evidence.

## Upgrade thesis

To justify $100k+ funding, LTP should move from:

```text
validated seed scaffold
```

into:

```text
externally reviewable benchmark and evidence package
```

The core claim should remain narrow:

```text
Path-level trace inspection can make specific classes of AI-agent failures reproducible, measurable, and reviewable.
```

## Evidence gaps for $100k+

| Gap | Current state | Needed for $100k+ |
|---|---|---|
| Benchmark size | 24 deterministic cases | 100-300 cases |
| Domain coverage | Initial scaffold | Coding, research, fintech, legal/citation, SRE |
| Baseline comparison | Planned | Qualitative first, measured later |
| External validation | Not yet established | 2-5 external reviewers or users |
| Technical report | Planned | Public report or preprint-style draft |
| Reproducibility package | Basic local commands | Frozen release + CI + report artifacts |
| Adoption signal | Early repo interest | Issues, stars, comments, external feedback |

## Workstream A: benchmark expansion

Goal: expand from 24 cases to 100-300 cases.

Minimum target for $100k readiness:

- 100 deterministic benchmark cases;
- at least 20 cases per major label family or domain slice where feasible;
- all cases have clear `case_id`, `expected_label`, `phase`, `note`, and `record`;
- benchmark regeneration remains deterministic.

Stretch target:

- 300 cases;
- versioned benchmark set;
- grouped results by failure class and domain.

## Workstream B: domain case studies

Goal: show LTP relevance outside toy fixtures.

Target case studies:

1. Coding agent trace.
2. Browsing or research agent trace.
3. Fintech policy workflow.
4. Legal or citation workflow.
5. SRE or incident workflow.

Each case study should include:

- scenario summary;
- trace or fixture;
- expected decision;
- actual decision;
- reason code;
- why ordinary review may miss it;
- limitations.

## Workstream C: baseline comparison

Goal: explain what LTP adds beyond common review methods.

Baselines:

- ordinary logs;
- final-output review;
- prompt-only guardrails;
- framework tracing.

Initial comparison can be qualitative. Measured claims must wait until measurement code exists.

## Workstream D: external validation

Goal: collect independent feedback without overstating adoption.

Targets:

- 2-5 independent reviewers;
- at least one AI-safety or agent-safety reviewer;
- at least one infra/devtools or QA reviewer;
- optional fintech/compliance reviewer.

External feedback artifacts:

- GitHub issues;
- signed review notes;
- public comments;
- reproducibility attempts;
- pilot interest notes.

Useful reviewer questions:

1. Is the problem framing clear?
2. Is path-level inspection distinct from ordinary logging?
3. Are the claims narrow enough?
4. Can the local benchmark be reproduced?
5. Which failure classes look most useful?
6. What would make this fundable at $100k+?

## Workstream E: technical report

Goal: produce a public technical report or preprint-style document.

Required sections:

- abstract;
- problem statement;
- related work positioning;
- LTP protocol scope;
- benchmark methodology;
- failure taxonomy;
- current results;
- baseline comparison;
- limitations;
- roadmap;
- reproducibility instructions.

Non-claims must remain explicit.

## Workstream F: reproducibility package

Goal: make review easy and verifiable.

Required artifacts:

- release tag;
- GitHub Actions green run;
- local validation notes;
- benchmark results snapshot;
- reviewer path;
- showcase trace map;
- release notes;
- known limitations.

## $100k+ readiness checklist

- [ ] 100+ benchmark cases.
- [ ] Benchmark grouped by failure class.
- [ ] Benchmark grouped by domain where possible.
- [ ] At least 3 domain case studies.
- [ ] Baseline comparison document.
- [ ] 2+ external reviewer comments or issues.
- [ ] Public technical report draft.
- [ ] Reproducibility package confirmed from clean checkout.
- [ ] Release tag after evidence upgrade.
- [ ] No unsupported claims.

## Suggested funding ask after upgrade

If the above checklist is substantially complete, a stronger ask becomes credible:

```text
$100k-$150k for 6-9 months
```

Positioning:

```text
LTP is an open-source benchmark and reviewer toolkit for path-level inspection of AI-agent traces.
```

## What not to do

- Do not inflate the current 24-case benchmark into a broad safety claim.
- Do not claim certification or compliance.
- Do not claim full AI alignment.
- Do not create synthetic numbers without measurement code.
- Do not bury limitations.

## Immediate next actions

1. Start WP1: expand benchmark fixtures to 100 cases.
2. Create baseline comparison document.
3. Ask 3 external reviewers to reproduce the tagged release.
4. Draft technical report skeleton.
5. Collect feedback as GitHub issues or public notes.

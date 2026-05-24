---
name: External review
about: Independent review of the LTP v0.2 evidence package
title: "External review: LTP v0.2 evidence package"
labels: documentation
assignees: ''
---

## Reviewer background

Briefly describe your relevant background or perspective.

Examples: AI safety, agent infrastructure, QA/devtools, compliance, research, open-source infrastructure.

## Overall recommendation for $100k-$150k funding consideration

Choose one:

- [ ] Yes
- [ ] Maybe
- [ ] No
- [ ] Not enough context

## Strongest point

What is most compelling about the evidence package?

## Main concern

What is weakest, unclear, or most risky?

## Reproducibility

Did you run the validation commands?

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

Result, if run:

```text
<please paste result summary here>
```

## Claim discipline

Are the claims narrow enough?

Any overclaims?

## Benchmark feedback

Is the 115-case deterministic scaffold useful?

What should be added or changed?

## Funding advice

What would make this more fundable?

## Suggested reading order

1. `docs/TECHNICAL_REPORT_DRAFT.md`
2. `benchmark/RESULTS.md`
3. `docs/SHOWCASE_TRACES.md`
4. `docs/BASELINE_COMPARISON.md`
5. `docs/DOMAIN_CASE_STUDIES.md`
6. `docs/EVALUATION_PROTOCOL.md`
7. `docs/GRANT_100K_EVIDENCE_PLAN.md`
8. `docs/EXTERNAL_REVIEWER_PACKET.md`

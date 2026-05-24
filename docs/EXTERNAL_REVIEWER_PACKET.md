# LTP External Reviewer Packet

Status: external review request package.

This document is for independent reviewers who can help evaluate whether LTP is ready for $100k+ AI safety / open-source infrastructure funding.

## Short summary

LTP is an open-source deterministic scaffold for path-level inspection of AI-agent traces.

It asks a narrower question than final-output review:

```text
Was the execution path grounded, replayable, and admissible?
```

Current evidence snapshot:

- Release tag: `v0.2-100k-evidence-upgrade`.
- Benchmark: 115 deterministic cases.
- Result: 115/115 correct classifications, 0 mismatches.
- Clean-checkout validation passed.
- Technical report draft exists.
- Domain case studies and baseline comparison exist.

## What we want reviewed

Please review whether the project is credible as a $100k-$150k evidence-ready open-source infrastructure proposal.

The most useful review is not a general compliment. The most useful review identifies:

- unclear claims;
- overclaiming risk;
- missing evidence;
- weak benchmark assumptions;
- reproducibility issues;
- whether the path-level inspection framing is distinct from ordinary logs, final-output review, prompt-only guardrails, or framework tracing.

## Recommended reading order

1. `docs/TECHNICAL_REPORT_DRAFT.md`
2. `benchmark/RESULTS.md`
3. `docs/SHOWCASE_TRACES.md`
4. `docs/BASELINE_COMPARISON.md`
5. `docs/DOMAIN_CASE_STUDIES.md`
6. `docs/EVALUATION_PROTOCOL.md`
7. `docs/GRANT_100K_EVIDENCE_PLAN.md`

## Optional reproducibility check

From a fresh checkout:

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

- `pnpm test` passes.
- `pnpm test:conformance` passes.
- benchmark reports 115/115 with 0 mismatches.
- `benchmark/RESULTS.md` remains unchanged after regeneration.
- working tree remains clean.

## Reviewer questions

Please answer as many as useful:

1. Is the problem framing clear?
2. Is path-level inspection meaningfully distinct from ordinary logging and framework tracing?
3. Are the claims narrow enough?
4. Are the non-claims explicit enough?
5. Is the 115-case deterministic benchmark useful as seed evidence?
6. What benchmark weakness would concern you most?
7. Which domain case study is most compelling?
8. Which failure class is most important?
9. What would make this more fundable at $100k-$150k?
10. Would you recommend external funding: yes / maybe / no?

## Suggested GitHub issue title

```text
External review: LTP v0.2 evidence package
```

## Suggested review structure

```markdown
## Reviewer background

Briefly describe your relevant background.

## Overall recommendation

Yes / Maybe / No for $100k-$150k funding consideration.

## Strongest point

What is most compelling?

## Main concern

What is weakest or unclear?

## Reproducibility

Did you run the commands?
If yes, what happened?
If no, why not?

## Claim discipline

Are the claims narrow enough?
Any overclaims?

## Benchmark feedback

Is the 115-case deterministic scaffold useful?
What should be added or changed?

## Funding advice

What would make this more fundable?
```

## Non-claims

LTP does not currently claim:

- full AI alignment;
- certified compliance;
- production security certification;
- universal model evaluation;
- broad empirical generalization beyond the deterministic scaffold.

The current release claim is narrower:

```text
LTP provides a reproducible 115-case deterministic scaffold for path-level inspection of AI-agent traces.
```

# Portfolio Reviewer Path

Status: OpenAI / grant / external reviewer navigation path.

This document gives a short reading path through the related repositories.

It is designed to answer one reviewer question quickly:

```text
Is this a coherent open-source evidence architecture for trustworthy agentic systems, or just a set of unrelated repositories?
```

## One-sentence summary

This portfolio builds an open-source evidence architecture for high-risk AI-agent behavior: pre-execution action gates, path-level trace inspection, causal permission lineage, decision memory, and human identity/revisability boundaries.

## Start here

Read these first:

1. Ecosystem spider map: `docs/ECOSYSTEM_SPIDER_MAP.md`
2. LTP technical report draft: `docs/TECHNICAL_REPORT_DRAFT.md`
3. LTP benchmark results: `benchmark/RESULTS.md`
4. PythiaLabs portfolio relationship: `https://github.com/safal207/pythiaLabs/blob/main/docs/PORTFOLIO_RELATIONSHIP.md`
5. CML portfolio relationship: `https://github.com/safal207/Causal-Memory-Layer/blob/main/docs/PORTFOLIO_RELATIONSHIP.md`
6. DMP portfolio relationship: `https://github.com/safal207/DMP-decision-memory-protocol/blob/main/docs/PORTFOLIO_RELATIONSHIP.md`
7. LRI portfolio relationship: `https://github.com/safal207/Living-Relational-Identity-LRI/blob/main/docs/PORTFOLIO_RELATIONSHIP.md`

## Repository roles

| Repository | Role | Current reviewer value |
|---|---|---|
| PythiaLabs | Pre-execution evidence gate for high-risk agentic actions. | Applied action-gate demo/product layer. |
| LTP | Path-level trace/replay/admissibility protocol. | Strongest current evidence anchor: 115-case deterministic benchmark and v0.2 evidence release. |
| CML | Causal permission and responsibility lineage. | Causal audit depth: why was the action allowed? |
| DMP | Decision memory and irreversibility governance. | Governance memory depth: what was decided, why, and did later reality make it irreversible? |
| LRI | Living identity and relational invariants. | Human-boundary depth: revisability, relational context, and identity authority. |

## If you only have 5 minutes

Read:

1. `docs/ECOSYSTEM_SPIDER_MAP.md`
2. `docs/TECHNICAL_REPORT_DRAFT.md`
3. `benchmark/RESULTS.md`
4. `docs/DOMAIN_CASE_STUDIES.md`

The point to verify:

```text
LTP has a reproducible 115-case deterministic scaffold for path-level inspection of AI-agent traces.
```

Then inspect PythiaLabs for the applied action-gate layer.

## If you are evaluating OpenAI / AI safety relevance

Focus on:

1. LTP path-level inspection and benchmark evidence.
2. PythiaLabs pre-execution evidence gates.
3. CML causal permission lineage.
4. DMP irreversible-risk governance memory.
5. LRI human revisability and identity-boundary protection.

Reviewer question:

```text
Can this portfolio make agentic failures more inspectable, replayable, causally reviewable, and governance-aware?
```

## If you are evaluating cybersecurity relevance

Focus on path-level and pre-execution failures:

- unsupported tool calls;
- missing approval gates;
- broken provenance;
- weak evidence;
- unsafe action preparation;
- trace tampering or unreviewable behavior;
- actions that should have been escalated before execution.

Best starting points:

1. LTP technical report: `docs/TECHNICAL_REPORT_DRAFT.md`
2. LTP baseline comparison: `docs/BASELINE_COMPARISON.md`
3. LTP domain case studies: `docs/DOMAIN_CASE_STUDIES.md`
4. PythiaLabs README: `https://github.com/safal207/pythiaLabs`
5. PythiaLabs evidence artifact schema: `https://github.com/safal207/pythiaLabs/blob/main/docs/evidence_artifact_schema.md`

## If you are evaluating fundability

The strongest current funding story is staged:

```text
Stage 1: LTP evidence package
Stage 2: PythiaLabs applied action-gate demos
Stage 3: CML causal audit expansion
Stage 4: DMP governance-memory expansion
Stage 5: LRI human-boundary / identity-governance expansion
```

Current strongest ask:

```text
$100k-$150k over 6-9 months
```

Most defensible use of funds:

- external reproducibility checks;
- benchmark expansion and failure-class grouping;
- third-party reviewer feedback;
- richer technical report/preprint;
- PythiaLabs applied demo hardening;
- CML causal-audit benchmark expansion;
- integration notes across the portfolio.

## Current evidence anchors

| Evidence | Location |
|---|---|
| LTP v0.2 evidence release | `v0.2-100k-evidence-upgrade` |
| LTP benchmark results | `benchmark/RESULTS.md` |
| LTP technical report draft | `docs/TECHNICAL_REPORT_DRAFT.md` |
| LTP domain case studies | `docs/DOMAIN_CASE_STUDIES.md` |
| LTP baseline comparison | `docs/BASELINE_COMPARISON.md` |
| LTP external reviewer packet | `docs/EXTERNAL_REVIEWER_PACKET.md` |
| PythiaLabs action-gate demos | `https://github.com/safal207/pythiaLabs` |
| CML benchmark evidence snapshot | `https://github.com/safal207/Causal-Memory-Layer/blob/main/docs/evidence/BENCHMARK_EVIDENCE_SNAPSHOT.md` |
| DMP validation snapshot | `https://github.com/safal207/DMP-decision-memory-protocol/blob/main/VALIDATION_RESULTS.md` |
| LRI validation snapshot | `https://github.com/safal207/Living-Relational-Identity-LRI/blob/main/VALIDATION_RESULTS.md` |

## Main non-claims

This portfolio does not claim:

- full AI alignment;
- certified compliance;
- production security certification;
- universal model evaluation;
- universal prevention of unsafe actions;
- automatic identity classification;
- replacement of human governance;
- replacement of legal, security, compliance, or clinical review.

The narrower portfolio claim is:

```text
These repositories define an early open-source evidence architecture for making high-risk AI-agent behavior more inspectable, replayable, causally reviewable, decision-aware, and human-boundary-aware.
```

## Recommended reviewer sequence

```text
1. Confirm LTP evidence package is reproducible.
2. Check whether PythiaLabs demonstrates a plausible applied action-gate path.
3. Check whether CML adds a distinct causal-permission layer.
4. Check whether DMP adds distinct decision-memory / irreversibility semantics.
5. Check whether LRI is clearly scoped as human-boundary governance, not profiling.
6. Check non-claims and limitations.
7. Decide whether the portfolio merits external funding or external review.
```

## Portfolio hardening trackers

- LTP evidence upgrade: `https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-/issues/460`
- LTP dependency triage: `https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-/issues/465`
- PythiaLabs hardening: `https://github.com/safal207/pythiaLabs/issues/189`
- CML hardening: `https://github.com/safal207/Causal-Memory-Layer/issues/85`
- DMP hardening: `https://github.com/safal207/DMP-decision-memory-protocol/issues/12`
- LRI hardening: `https://github.com/safal207/Living-Relational-Identity-LRI/issues/38`

# Two-Phase Semantic Inspector: Overview

The Two-Phase Semantic Inspector adds protocol-level provenance checks to generated content. It does not assume model internals are controllable; it assumes outputs must be admissible against thread history.

## The Problem

Hallucinations are usually framed as model mistakes. In LTP terms, that framing is incomplete.

A hallucination is an **invalid transition**:
- a claim is emitted,
- but the claim cannot be traced to admissible thread state,
- so the protocol cannot justify that transition.

When this happens, the failure is infrastructural. The system allowed an ungrounded state transition to pass. The Two-Phase Semantic Inspector makes that condition explicit and machine-checkable.

## Orientation as Root Primitive

LTP uses three invariants as guardrails for coherent operation:

1. **Orientation** — the system must remain grounded in explicit, inspectable context.
2. **Continuity** — state evolution must be traceable across transitions.
3. **Admissibility** — only protocol-valid futures can be committed.

Semantic inspection operationalizes these invariants for factual claims:
- Phase 1 protects **Orientation** and **Admissibility** before generation by verifying declared anchors exist and are admissible.
- Phase 2 protects **Continuity** and **Admissibility** after generation by checking generated factual claims against declared anchors and current trace status.

## Two-Phase Architecture

```text
┌──────────────────────┐
│ 1) Declare anchors   │  anchors[] = {claim, transition_id, ...}
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 2) Phase 1           │  validateAnchors(anchors, trace, config)
│    Anchor Validation │  - transition exists
│                      │  - optional hash/chunk checks
│                      │  - rejected/drifted branch checks
└──────────┬───────────┘
           │ pass
           ▼
┌──────────────────────┐
│ 3) Generate output   │  model/runtime emits text
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 4) Phase 2           │  checkSemanticCoherence(output, anchors, trace, config)
│    Coherence Check   │  - extract factual claims
│                      │  - map claim ↔ declared anchor
│                      │  - detect novel/unanchored facts
│                      │  - detect drift/rejection against trace
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 5) Commit decision   │  PROCEED | REJECT | BLOCK | AUDIT
└──────────────────────┘
```

## Phase 1 vs Phase 2

Both phases are required because they detect different failure classes:

- **Phase 1 (pre-generation)** catches invalid provenance declarations before output is produced:
  - fabricated transition IDs,
  - mismatched hash snippets (strict mode),
  - anchors in rejected/drifted branches,
  - empty anchor sets when explicit provenance is mandatory.

- **Phase 2 (post-generation)** catches semantic drift in emitted output:
  - factual claims with no anchor mapping,
  - claims anchored to now-missing transitions,
  - claims anchored to drifted/rejected states.

Without Phase 1, you can generate against bad anchors. Without Phase 2, you can pass Phase 1 and still emit novel unsupported claims.

## What LTP Does Not Do

The semantic inspector does **not** retrain, patch, or otherwise modify model cognition. LTP's position is protocol-centric:

- generation may still produce bad claims,
- but bad claims become detectable as provenance/coherence violations,
- and policy can block or reject them before commit.

So the guarantee is not "the model never hallucinates"; the guarantee is "hallucinations become observable policy events at the protocol boundary."

## Defence in Depth

LTP already has structural inspection (`ltp inspect trace`) for orientation, continuity, and compliance signals. The semantic inspector is a complementary layer:

- **Structural inspector**: verifies frame/trace integrity and orientation-level protocol health.
- **Semantic inspector**: verifies claim-level provenance and coherence.

Together, they provide defence in depth: one layer protects protocol structure, the other protects factual admissibility.

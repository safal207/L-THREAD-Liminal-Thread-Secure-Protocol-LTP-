# LTP Specification Index (Frozen Core v0.1)
Status: **NON-NORMATIVE (index only)**

This index lists the canonical **Frozen Core v0.1** documents and summarizes their status labels.  
It **does not introduce new requirements** or define protocol behavior; it only points to the sources of truth.

## Scope

This index applies only to **Frozen Core v0.1** and the documents explicitly labeled **Normative** below.  
Tooling, SDKs, DevTools, and examples may evolve independently without changing Frozen Core semantics.

## How to use this index

- **Implement LTP:** read the **Normative** list first; those files are the contract.  
- **Build tooling / SDKs:** follow the **Conformance** and **Schemas** entries to align reports and validators.  
- **Write docs or guidance:** do not restate or modify requirements—link to the normative files instead.

## Canonical document status

### Normative (Frozen Core v0.1)

- `./specs/LTP-core.md` — protocol principles and primitives
- `./specs/LTP-Frames-v0.1.md` — frame structure and encoding
- `./specs/LTP-Canonical-Flow-v0.1.md` — canonical event/transition flow
- `./specs/LTP-Conformance-v0.1.md` — conformance obligations and levels
- `./schemas/ltp-conformance-report.v0.1.json` — conformance report schema

### Informative / Guidance

- `./specs/LTP-THINKS-v0.1.md`
- `./docs/` — tutorials, playbooks, and supporting notes
- `./tools/` — dev tooling and utilities
- `./adoption/` — adoption patterns and checklists
- `./positioning/` — market and messaging context
- `./governance/` — process documents; not protocol semantics
- `./protocol-limits/` — operational limits; not part of Frozen Core

### Recommended reading order (normative set)

1. `./specs/LTP-core.md` — start here for the vocabulary and primitives.  
2. `./specs/LTP-Frames-v0.1.md` — understand how Frames carry state.  
3. `./specs/LTP-Canonical-Flow-v0.1.md` — follow the event/transition lifecycle.  
4. `./specs/LTP-Conformance-v0.1.md` — see how implementations prove correctness.  
5. `./schemas/ltp-conformance-report.v0.1.json` — produce interoperable conformance artifacts.

---

## Terminology guardrails (index reminders — non-normative)

These reminders keep terminology consistent when reading or editing the normative set. They do **not** add requirements.

### No silent mutation of orientation

Orientation MUST NOT change without an explicit event in the canonical flow. Any change MUST appear as a Transition/Event with a traceable cause.

### Avoid “update” without transition semantics

Prefer explicit protocol terms: **Event**, **Transition**, **Frame**, **Replay**, **Conformance**.

### Keep metaphors out of the contract

Metaphors belong in **Informative/Guidance** docs. The Frozen Core contract MUST remain testable, deterministic, and implementation-neutral.

## Hygiene

This index is covered by the docs hygiene check (`scripts/check-no-bidi.mjs` in CI) that rejects hidden or bidirectional Unicode characters.

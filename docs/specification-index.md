# LTP Specification Index (Frozen Core v0.1)

## Status (Non-Normative Index)

This document is **NON-NORMATIVE**.  
It does **not** define protocol behavior by itself. It is an index that **points to** the normative documents that define **Frozen Core v0.1** and its conformance expectations.

## Scope Clarification

This index applies only to **Frozen Core v0.1** and the documents explicitly labeled **Normative** below.  
Tooling, SDKs, DevTools, and examples may evolve independently without changing Frozen Core.

---

## Canonical Status

The **Frozen Core v0.1 normative surface** is defined by the documents labeled **Normative** below.  
All other documents are **Informative** or **Guidance**: they may explain, illustrate, or operationalize LTP, but they do not change Frozen Core semantics.

---

## Documents

### Normative (Frozen Core v0.1)

- `specs/LTP-core.md` — **Normative**
- `specs/LTP-Frames-v0.1.md` — **Normative**
- `specs/LTP-Canonical-Flow-v0.1.md` — **Normative**
- `specs/LTP-Conformance-v0.1.md` — **Normative**
- `schemas/ltp-conformance-report.v0.1.json` — **Normative**

### Informative / Guidance

- `specs/LTP-THINKS-v0.1.md` — **Informative**
- `docs/` — **Guidance**
- `tools/` — **Guidance**
- `adoption/` — **Guidance**
- `positioning/` — **Informative**
- `governance/` — **Informative** (process), not protocol semantics
- `protocol-limits/` — **Guidance** (operational limits), not Frozen Core

---

## Normative Rules (Index-Level)

The rules below are **Normative only for interpretation of Frozen Core**.  
They do not introduce new semantics beyond the Normative documents listed above.

### 1) No Silent Mutation of Orientation

Orientation MUST NOT be changed without an explicit event in the canonical flow.
If something changes, it MUST appear as a Transition/Event with a traceable cause.

### 2) No “Update” Without Transition Semantics

Avoid ambiguous terminology like “update orientation” in normative text.
Use explicit protocol terms: **Event**, **Transition**, **Frame**, **Replay**, **Conformance**.

### 3) Keep Metaphors Out of the Contract

Metaphors are allowed in **Informative/Guidance** docs.
The Frozen Core contract MUST remain testable, deterministic, and implementation-neutral.

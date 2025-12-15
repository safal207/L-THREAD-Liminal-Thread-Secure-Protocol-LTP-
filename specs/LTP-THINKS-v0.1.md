# LTP THINKS v0.1

## What LTP Is — and What It Is Not

### Purpose

This document defines the thinking boundaries of the Liminal Thread Protocol (LTP).

Its goal is not to describe how LTP is implemented, but how it must be understood.
This document exists to prevent misuse, misinterpretation, and architectural drift.

LTP is intentionally narrow in scope and deep in consequence.

---

### What LTP Is

**1. LTP is a protocol, not a product**

LTP defines:

- interaction semantics,
- temporal flow,
- routing principles,
- conformance rules.

LTP does not define:

- a business model,
- a user interface,
- a storage layer,
- a recommendation algorithm.

Products may be built on top of LTP.
LTP itself remains neutral.

---

**2. LTP is a meaning-routing protocol, not a data pipeline**

LTP operates on:

- frames, not datasets,
- orientation, not prediction,
- branching, not optimization.

LTP answers the question:

> “What are the plausible next paths, given where we are now?”

It does not answer:

> “What is the best outcome?”
> “What should the user do?”
> “What maximizes engagement?”

---

**3. LTP is deterministic, explainable, and inspectable**

An LTP-conformant system:

- must explain why a route was suggested,
- must expose contributing factors,
- must degrade gracefully under uncertainty.

Opaque scoring, hidden heuristics, and black-box decisions are explicitly discouraged.

---

**4. LTP is storage-agnostic and infrastructure-light**

LTP does not require:

- centralized databases,
- global state,
- large historical datasets.

Frames are ephemeral by design.
Persistence is optional and external.

---

**5. LTP is compatible with humans, agents, and systems**

LTP makes no assumption about the nature of the participant:

- human,
- AI agent,
- hybrid system,
- automated process.

All participants interact through the same frame semantics.

---

### What LTP Is Not

**1. LTP is NOT a recommendation system**

LTP does not rank content. LTP does not optimize clicks, time-on-platform, or revenue. LTP does not attempt to predict user behavior.

Any system using LTP as a recommender engine is misusing the protocol.

---

**2. LTP is NOT a machine learning framework**

LTP:

- does not require ML,
- does not train models,
- does not define loss functions.

ML systems may consume LTP signals.
LTP itself remains model-agnostic.

---

**3. LTP is NOT a social network or identity layer**

LTP does not:

- manage identities,
- authenticate users,
- enforce permissions,
- define social graphs.

These concerns belong to external layers.

---

**4. LTP is NOT a UX or HUD specification**

LTP does not define:

- screens,
- dashboards,
- visual metaphors.

Any HUD or client is an interpretation, not the protocol.

---

**5. LTP is NOT a control system**

LTP does not command. LTP does not enforce. LTP does not override agency.

LTP offers structure without coercion.

---

### Design Principles (Non-Negotiable)

- Minimalism over completeness
- Explainability over performance
- Plurality over singular outcomes
- Orientation over optimization
- Conformance over innovation shortcuts

---

### Intended Audience

LTP is designed for:

- protocol engineers,
- system architects,
- researchers,
- infrastructure builders.

LTP is not designed for:

- growth hackers,
- engagement optimizers,
- quick-demo tooling.

---

### Stability Commitment

Breaking changes to LTP semantics require:

- a new protocol version,
- updated conformance specs,
- explicit migration notes.

Silent semantic drift is unacceptable.

---

### Final Note

LTP does not try to replace existing systems.
It creates space between them.

That space is intentional.

---

### Declaration

Any implementation that respects this document
and passes LTP conformance requirements
may claim:

> “This system follows the LTP THINKS principles (v0.1).”

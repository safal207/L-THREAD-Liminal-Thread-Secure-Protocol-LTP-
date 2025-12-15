# LTP Governance & RFC Process v0.1

## How the Liminal Thread Protocol Evolves

### Purpose

This document defines the governance model and RFC (Request for Comments) process for the Liminal Thread Protocol (LTP).

Its goal is to ensure:

- long-term stability,
- architectural coherence,
- resistance to capture by single vendors or interests,
- gradual, explainable evolution.

LTP is intended to become a de-facto standard.
Standards require governance.

---

### Core Principles of Governance

**1. Protocol First, Implementations Second**

The protocol defines truth.

SDKs, nodes, clients, and HUDs follow the protocol — never the opposite.

No implementation may redefine LTP semantics unilaterally.

---

**2. Open but Conservative Evolution**

LTP evolves:

- slowly,
- explicitly,
- with backward compatibility as a priority.

Innovation happens around the protocol, not inside it by default.

---

**3. Neutrality & Non-Capture**

LTP governance is designed to prevent:

- corporate capture,
- single-vendor dominance,
- hidden proprietary extensions.

No entity “owns” the protocol.

---

### Governance Structure

**1. LTP Core Maintainers**

Responsibilities:

- steward protocol integrity,
- approve RFCs,
- maintain reference specifications,
- arbitrate conflicts.

Constraints:

- no unilateral semantic changes,
- decisions must be documented and traceable.

---

**2. Advisory Board (Non-Binding)**

The Advisory Board:

- provides strategic and cross-domain perspective,
- reviews major RFCs,
- highlights risks (technical, ethical, ecosystem).

Advisory opinions are public but non-binding.

---

**3. Implementers & Community**

Anyone may:

- implement LTP,
- submit RFCs,
- publish extensions,
- build products.

Conformance determines legitimacy — not status.

---

### RFC Process (LTP-RFC)

#### RFC Scope

RFCs may propose:

- new frame types,
- clarifications of semantics,
- conformance rules,
- versioning strategy,
- deprecation paths.

RFCs may NOT:

- silently redefine existing semantics,
- break conformance guarantees without a version bump.

---

#### RFC Lifecycle

**1. Draft**

RFC is submitted as a document.

Marked as Draft.

Open for discussion.

**2. Review**

Maintainers and community review.

Concerns and alternatives documented.

**3. Accepted / Rejected / Deferred**

Accepted → scheduled for a protocol version.

Rejected → rationale documented.

Deferred → valid idea, insufficient maturity.

**4. Implemented**

Reference specification updated.

Conformance rules adjusted if needed.

---

#### RFC Format (Minimal)

Each RFC MUST include:

- Motivation
- Problem Statement
- Proposed Change
- Backward Compatibility Analysis
- Impact on Conformance
- Alternatives Considered

---

### Versioning Policy

- Semantic meaning changes → new protocol version
- Additive, optional features → same version
- Experimental ideas → extensions, not core

---

### Extensions Policy

- Extensions MUST NOT masquerade as core LTP.
- Extensions MUST be clearly namespaced.
- Core LTP remains minimal.

---

### Conflict Resolution

When disagreement arises:

1. Protocol principles override convenience.
2. Conformance overrides popularity.
3. Explicit documentation overrides implicit behavior.

If needed, maintainers may freeze changes temporarily.

---

### Transparency Requirements

- All decisions are public.
- All RFC discussions are archived.
- No closed-door semantic changes.

---

### Relationship to Other Standards Bodies

LTP governance is compatible with:

- IETF-style RFC processes,
- W3C consensus models,
- Open-source meritocratic governance.

LTP does not require formal incorporation to function.

---

### Stability Commitment

Once a version is declared stable:

- its semantics will not change,
- only clarifications may be added.

Breaking changes require a new version.

---

### Declaration

Any system that:

- follows the RFC process,
- respects governance rules,
- maintains conformance,

may claim:

> “This implementation follows LTP Governance & RFC Process (v0.1).”

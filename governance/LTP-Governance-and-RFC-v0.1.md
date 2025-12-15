# LTP Governance & RFC Lifecycle v0.1

## How Liminal Thread Protocol Evolves Without Losing Its Soul

### Purpose

This document defines how the Liminal Thread Protocol (LTP) evolves over time without fragmentation, capture, or central control.

The goal of LTP governance is stability with growth, not velocity for its own sake.

---

### Core Governance Principle

> LTP is governed by constraints, not by power.

No single company, individual, or organization owns the protocol.
Influence is earned through clarity, usefulness, and demonstrated alignment with the protocol’s principles.

---

### What Governance Is (and Is Not)

Governance IS:

- A way to prevent protocol drift
- A method to ensure cross-implementation compatibility
- A memory of why design decisions were made
- A trust signal for adopters

Governance IS NOT:

- A steering committee for business interests
- A centralized roadmap authority
- A voting popularity contest
- A gatekeeping mechanism

---

### Governance Layers

**1. Protocol Core (Very Small)**

Includes:

- Frame contract (LTP-Frames)
- Canonical flow semantics
- Versioning rules
- Conformance definitions

Changes here are rare and conservative.

---

**2. Extension Surface (Open)**

Includes:

- New frame types
- New metrics
- Optional flows
- Domain-specific semantics

Extensions MUST:

- Be additive
- Be ignorable by older implementations
- Never break core flows

---

**3. Implementations (Unrestricted)**

SDKs, nodes, HUDs, visualizers, diagnostics, services.

Governance does not control:

- UX decisions
- Business models
- Hosting strategies
- Language choice

---

### LTP RFC Process

**RFC Definition**

An LTP RFC is a structured proposal that introduces, modifies, or clarifies protocol behavior.

RFCs exist to:

- Capture intent
- Enable review
- Preserve rationale over time

---

### RFC Lifecycle

**1. Draft**

Author publishes an RFC document

Clearly states:

- Motivation
- Problem
- Proposed change
- Compatibility impact

Status: Draft

---

**2. Review**

- Community feedback
- Implementation experiments encouraged
- No voting, only arguments

Status: Review

---

**3. Acceptance**

RFC is marked accepted when:

- At least two independent implementations exist
- No core principles are violated
- Backward compatibility is preserved

Status: Accepted

---

**4. Canonicalization**

RFC is referenced by:

- Conformance rules
- Canonical flow definitions

Optional for extensions

Status: Canonical

---

**5. Deprecation (Rare)**

- Old behavior marked discouraged
- No forced removal
- Long sunset periods

Status: Deprecated

---

### Decision Authority Model

There is no central ruler.

Authority emerges from:

- Consistent contributions
- High-quality reasoning
- Successful implementations
- Respect for constraints

This mirrors:

- TCP/IP evolution
- UNIX philosophy
- Kubernetes SIG dynamics

---

### Conflict Resolution

When disagreement occurs:

1. Favor backward compatibility
2. Favor smaller surface area
3. Favor explainability over performance
4. Favor multiple branches over single “best” answers

If unresolved:

- Competing extensions may coexist
- Reality (adoption) decides

---

### Governance Anti-Patterns (Explicitly Rejected)

- ❌ Mandatory compliance fees
- ❌ Corporate veto power
- ❌ Roadmap centralization
- ❌ Fast-breaking innovation
- ❌ “Winning” through dominance

---

### Relationship to Implementations

Implementations MAY:

- Claim LTP conformance
- Display conformance badges
- Offer governance participation

They MUST NOT:

- Redefine protocol meaning
- Introduce incompatible forks under the same name

---

### Long-Term Vision

LTP governance is designed to survive:

- Founder absence
- Corporate pressure
- Market cycles
- Technological shifts

If LTP succeeds, it should eventually feel boring, stable, and inevitable.

---

### Declaration

> LTP is governed by continuity, not control.
> If it grows, it must grow gently.

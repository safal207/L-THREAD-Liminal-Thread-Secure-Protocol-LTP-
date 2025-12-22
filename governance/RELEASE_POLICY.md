# LTP v0.1 Freeze & Versioning Policy

**Status:** Core Frozen (v0.1)

This document formally declares LTP v0.1 as frozen.

From this point forward, the core protocol invariants are considered stable and non-negotiable.

LTP is no longer in an exploratory or explanatory phase.
It has entered its infrastructure stability phase.

---

## What “Frozen” Means

The following elements are frozen in v0.1:

* Core definitions of orientation, continuity, and admissibility
* Separation between protocol and decision logic
* Non-goals and forbidden patterns
* Mental models and invariants described in the core documentation

No semantic changes to these concepts are allowed in v0.1.

---

## What Is Allowed After Freeze (v0.1)

The following changes are permitted:

* Typo fixes
* Grammar corrections
* Clarifications that do not expand scope
* Examples outside the core protocol
* Documentation formatting improvements
* Additional explanations that restate existing rules without reinterpretation

These changes must not introduce:

* new concepts
* new responsibilities
* new capabilities
* new guarantees

---

## What Is NOT Allowed in v0.1

The following are explicitly forbidden after this freeze:

* Adding new protocol responsibilities
* Introducing decision logic or optimization semantics
* Expanding the meaning of orientation or continuity
* Reframing LTP as a framework, agent system, or execution layer
* Silent scope expansion through documentation

Any change that alters protocol semantics requires a new major version.

---

## Versioning Policy

### v0.1.x

* Documentation fixes
* Clarifications without semantic change
* Reference examples

### v0.2+

* Any semantic change
* Any expansion of protocol capabilities
* Any modification to invariants

Breaking or expanding changes must never be backported into v0.1.

---

## Why This Matters

Protocols fail when:

* boundaries blur
* scope expands silently
* infrastructure starts making decisions

LTP survives by refusing that drift.

Freezing v0.1 is not a pause.
It is a commitment to long-term stability.

---

## Final Note

From this point on:

> LTP v0.1 is something you build on top of,
> not something you keep redefining.

All future innovation belongs above the protocol,
not inside it.

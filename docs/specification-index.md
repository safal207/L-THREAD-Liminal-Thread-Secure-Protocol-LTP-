# LTP Canonical Specification Index (Frozen Core v0.1)
Status: Frozen Core v0.1 (normative)

This document defines the canonical set of normative specifications
that collectively describe the Liminal Thread Protocol (LTP).

These documents together form the frozen core of the protocol.
Any LTP-compliant implementation MUST adhere to all specifications listed below.

The key words “MUST”, “MUST NOT”, and “SHOULD” in this document are to be interpreted as described in RFC 2119 and RFC 8174.

---

## Scope Clarification

This document does NOT modify the LTP Frozen Core v0.1.

It defines:
- clarifications
- usage constraints
- extension guidelines

All Frozen Core invariants remain unchanged.

---

## Normative Documents

### 1. Protocol Limits
**Document:** [LTP-Limits-of-LTP.md](./canon/LTP-Limits-of-LTP.md)  
**Defines:** The boundaries of applicability for LTP.

This document specifies where LTP is intentionally not applicable
and where its guarantees do not extend.

---

### 2. Non-Goals
**Document:** [LTP-Non-Goals-as-Design-Constraints.md](./canon/LTP-Non-Goals-as-Design-Constraints.md)  
**Defines:** What LTP explicitly does not attempt to do.

Non-goals protect the protocol from scope creep
and preserve its role as infrastructure rather than a product.

---

### 3. Protocol Invariants
**Document:** [invariants.md](./invariants.md)  
**Defines:** Properties that MUST hold for all LTP-compliant implementations.

Violating any invariant renders an implementation non-compliant.

---

### 4. Allowed Failure Modes
**Document:** [LTP-Allowed-Failure-Modes.md](./canon/LTP-Allowed-Failure-Modes.md)  
**Defines:** Failures that are explicitly permitted within LTP systems.

Failure is acceptable as long as orientation continuity is preserved.
Silent loss of orientation is forbidden.

---

## Normative Rules

- Orientation MUST only change via explicit transition events. Implicit inference, heuristic adjustment, or silent correction of Orientation state is NOT permitted by the protocol.
- Orientation Event, Transition, and Update are distinct terms. Use “Orientation Event” when describing inputs to the transition log; “Transition” when referring to state changes; and avoid using “Update” as a synonym for “Transition.”
- “Frozen Core” is a proper noun and MUST appear capitalized in normative text.

These rules constrain extensions so they do not dilute the Frozen Core.

---

## Non-Normative Guidance

The following items are provided as best practices (non-normative):

- Keep advisory logic (heuristics, scoring, routing shortcuts) in clearly labeled extensions rather than in the Frozen Core surface.
- If a document contains examples or patterns, label them as guidance to avoid conflating them with MUST/MUST NOT requirements.
- Consider placing experimental orientation strategies in an `extensions/` subtree (e.g., `extensions/orientation-strategies.md`) to make boundaries explicit.

---

## Canonical Status

The documents listed above collectively define the LTP protocol core.

Changes to these documents:
- MUST follow the RFC process
- MUST preserve backward compatibility
- MUST NOT be introduced silently

All other documentation, tooling, SDKs, and implementations
are considered non-normative and may evolve independently.

---

## Compliance Statement

An implementation is considered LTP-compliant if and only if:
- All protocol invariants are preserved; any invariant violation renders the implementation non-compliant
- All non-goals are respected
- All allowed failure modes are handled explicitly
- No silent loss of orientation occurs in any operation or state transition

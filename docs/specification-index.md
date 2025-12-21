# LTP Canonical Specification Index

This document defines the canonical set of normative specifications
that collectively describe the Liminal Thread Protocol (LTP).

These documents together form the frozen core of the protocol.
Any LTP-compliant implementation MUST adhere to all specifications listed below.

---

## Normative Documents

### 1. Protocol Limits
**Document:** limits.md  
**Defines:** The boundaries of applicability for LTP.

This document specifies where LTP is intentionally not applicable
and where its guarantees do not extend.

---

### 2. Non-Goals
**Document:** non-goals.md  
**Defines:** What LTP explicitly does not attempt to do.

Non-goals protect the protocol from scope creep
and preserve its role as infrastructure rather than a product.

---

### 3. Protocol Invariants
**Document:** invariants.md  
**Defines:** Properties that MUST hold for all LTP-compliant implementations.

Violating any invariant renders an implementation non-compliant.

---

### 4. Allowed Failure Modes
**Document:** allowed-failure-modes.md  
**Defines:** Failures that are explicitly permitted within LTP systems.

Failure is acceptable as long as orientation continuity is preserved.
Silent loss of orientation is forbidden.

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
- All protocol invariants are preserved
- All non-goals are respected
- All allowed failure modes are handled explicitly
- No silent loss of orientation occurs

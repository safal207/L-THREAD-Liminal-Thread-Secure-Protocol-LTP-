# LTP Protocol Invariants

This document defines the invariants of the Liminal Thread Protocol (LTP).
Invariants are properties that MUST hold regardless of implementation, environment, or usage context.

---

## Invariants (normative)

1. **Orientation Continuity**
   - Orientation state MUST evolve monotonically over transitions.
   - Orientation MUST NOT be implicitly reset.

2. **Deterministic Replay**
   - Given the same inputs, LTP MUST produce the same transition trace.
   - Replay MUST be possible without model execution.

3. **Separation of Concerns**
   - LTP MUST NOT perform inference.
   - LTP MUST NOT execute actions.

4. **Observability**
   - Orientation, drift, and admissible futures MUST be inspectable.
   - State MUST be externally observable via tooling.

5. **Protocol Neutrality**
   - LTP MUST remain model-agnostic.
   - LTP MUST remain framework-agnostic.

---

If an implementation violates any invariant,
it is no longer LTP-compliant.

---

Related documents:
- limits.md
- non-goals.md
- governance.md

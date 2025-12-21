# PR 227 — Allowed Failure Modes

This document defines failure modes that are explicitly allowed within LTP-compliant systems.

Failure is not an error if continuity constraints are preserved.

## Allowed Failure Modes

### Allowed Failure 1 — Model Failure
- Inference MAY fail.
- Model output MAY be invalid.
- Orientation MUST remain intact.

### Allowed Failure 2 — Action Failure
- Actions MAY not execute.
- External systems MAY reject requests.
- Transitions MUST be recorded.

### Allowed Failure 3 — Partial State Loss
- Local caches MAY reset.
- Network connections MAY drop.
- Orientation recovery MUST be possible via replay.

### Allowed Failure 4 — Human Intervention
- Manual overrides are allowed.
- Overrides MUST be explicit and traceable.

## Hard Boundary

Any failure that causes silent loss of orientation violates LTP invariants.

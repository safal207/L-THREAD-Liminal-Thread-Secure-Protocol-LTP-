# LTP Invariants

These invariants define what “LTP-compatible” means.

## I1 — No outcomes
LTP must never decide outcomes.
It may only validate transition admissibility.

## I2 — Separation of planes
Orientation and constraints (control plane) are separate from inference/execution (data plane).

## I3 — Replayability
Orientation transitions must be replayable and verifiable from a trace.

## I4 — Local failure
Errors are local.
Failures must not silently corrupt global continuity.

## I5 — Model-agnostic continuity
Models may change without breaking orientation, as long as transitions remain admissible.

## I6 — Explicit constraints
Constraints must be explicit and testable (not hidden inside ad-hoc logic).

## I7 — No silent scope creep
If LTP begins to absorb decision logic, ranking, or goals — the protocol is violated.

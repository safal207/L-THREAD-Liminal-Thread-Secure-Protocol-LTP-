# LTP Orientation Invariants

These invariants define what it means for a system to remain oriented. Violating any of them results in loss of coherence, not just error.

## Invariant 1: Orientation Must Be Explicit
Orientation cannot be inferred implicitly from model state. It must be declared, inspectable, and replayable.

## Invariant 2: Drift Is Accumulated, Not Reset
Local errors may occur. Orientation drift must remain traceable across retries instead of being silently cleared.

## Invariant 3: Identity Is Stable Across Transitions
Transitions may change state, not identity. Identity continuity is a precondition for replay and accountability.

## Invariant 4: Futures Are Admissible, Not Chosen
LTP enumerates possible futures; selection happens outside the protocol. Admissibility stays separate from execution.

## Invariant 5: Violations Are Semantic Events
A violation is data, not an exception. It must be recorded and communicated as part of the protocol surface.

# LTP: Open Research Questions

This document lists intentionally unresolved questions in the Liminal Thread Protocol.

These are not missing features.
They are explicitly non-normative areas left open to preserve the stability of the Frozen Core
while allowing research, experimentation, and ecosystem growth.

## Status

This document is **informative**.

Nothing here affects:
- protocol correctness
- conformance requirements
- normative behavior

The Frozen Core v0.1 remains fully defined elsewhere.

## Orientation & Centering

Open questions:

- What is the minimal state required to preserve orientation across discontinuities?
- Can multiple centers coexist without collapsing coherence?
- How should orientation decay or drift be modeled over long idle periods?
- Is orientation reset always explicit, or can it be inferred safely?

These questions are deliberately excluded from the core protocol.
Different implementations may explore different answers.

## Trajectories & Admissible Futures

Open questions:

- Optimal branching factor for admissible futures
- Trade-offs between exploration breadth and determinism
- When should futures collapse, merge, or expire?
- How to visualize or serialize trajectories without leaking semantics?

The protocol only defines *that* trajectories exist, not *how* they are scored or explored.

## Determinism vs Adaptivity

Open questions:

- How much non-determinism is acceptable before coherence degrades?
- Can adaptive systems remain auditable without freezing behavior?
- Where is the boundary between protocol guarantees and model freedom?

LTP guarantees continuity, not optimality.

## Experimental Directions

Safe areas for experimentation:

- routing strategies
- orientation metrics
- decay functions
- visualization layers
- human-in-the-loop controls

Any such experimentation MUST NOT modify the normative core.

## Design Intent

LTP is intentionally incomplete by design.

Its purpose is not to answer all questions,
but to provide a stable axis around which answers can evolve
without fragmenting continuity.

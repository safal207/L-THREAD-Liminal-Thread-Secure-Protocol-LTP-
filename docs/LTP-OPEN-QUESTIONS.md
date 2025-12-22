# LTP: Open Research Questions

This document lists intentionally unresolved questions in the Liminal Thread Protocol.

These are not missing features.
They are explicitly non-normative areas left open to preserve the stability of the Frozen Core
while allowing research, experimentation, and ecosystem growth.

See also: `governance/LTP-RFC-Process.md` for proposing experiments without modifying the Frozen Core.
Non-goal: This document does **not** define protocol behavior or alter conformance requirements.

## Status

This document is **informative**.

Nothing here affects:
- protocol correctness
- conformance requirements
- normative behavior

The Frozen Core v0.1 remains fully defined elsewhere.

## Orientation & Centering

Open questions (non-normative):

- Q-ORIENT-1: What is the minimal state required to preserve orientation across discontinuities (restarts, reconnects, provider swaps, context truncation)?
- Q-ORIENT-2: Can multiple centers coexist without collapsing coherence?
- Q-ORIENT-3: How should orientation decay or drift be modeled over long idle periods?
- Q-ORIENT-4: Is orientation reset always explicit, or can it be inferred safely?

These questions are deliberately excluded from the core protocol.
Different implementations may explore different answers.

## Trajectories & Admissible Futures

Open questions (non-normative):

- Q-FUTURE-1: Optimal branching factor for admissible futures
- Q-FUTURE-2: Trade-offs between exploration breadth and determinism
- Q-FUTURE-3: When should futures collapse, merge, or expire? Branch collapse/merge policies are implementation-defined and MUST NOT affect core conformance.
- Q-FUTURE-4: How to visualize or serialize trajectories without leaking semantics?
- Q-FUTURE-5: How to store or replay traces without PII or prompt leakage? What redaction strategies keep traces safe for audits?

The protocol only defines *that* trajectories exist, not *how* they are scored or explored.

## Determinism vs Adaptivity

Open questions (non-normative):

- Q-DETERMINISM-1: How much non-determinism is acceptable before coherence degrades?
- Q-DETERMINISM-2: Can adaptive systems remain auditable without freezing behavior?
- Q-DETERMINISM-3: Where is the boundary between protocol guarantees and model freedom?

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

## How to contribute

If you want to explore any of these questions, open an issue or submit an RFC in `governance/`.

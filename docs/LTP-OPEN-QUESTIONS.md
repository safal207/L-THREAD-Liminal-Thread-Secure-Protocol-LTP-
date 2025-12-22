# LTP: Open Research Questions

This document lists intentionally unresolved questions in the Liminal Thread Protocol.
These are not missing features. They are explicitly non-normative areas left open to preserve the stability of the Frozen Core while allowing research, experimentation, and ecosystem growth. Locking them prematurely would inject product or model opinions into the protocol and weaken deterministic replay and neutrality.

See also: `governance/LTP-RFC-Process.md` for proposing experiments without modifying the Frozen Core.
Non-goal: This document does **not** define protocol behavior or alter conformance requirements.

## Status

This document is **informative**.

Nothing here affects:
- protocol correctness
- conformance requirements
- normative behavior

The Frozen Core v0.1 remains fully defined elsewhere.

## Design Limits vs Misuse

Design limits are properties the protocol will never implement. They protect invariants such as deterministic replay, cross-model neutrality, and long-term interpretability.

Misuse refers to incorrect layering or responsibility assignment by downstream systems. Misuse is possible, but wrong, because it pushes product semantics into the protocol and erodes the same invariants.

The questions below sit inside the design limits but outside the Frozen Core. They highlight where experimentation is allowed without redefining the protocol.

## Orientation & Centering

Open questions (non-normative):

- Q-ORIENT-1: What is the minimal state required to preserve orientation across discontinuities (restarts, reconnects, provider swaps, context truncation)?
- Q-ORIENT-2: Can multiple centers coexist without collapsing coherence?
- Q-ORIENT-3: How should orientation decay or drift be modeled over long idle periods?
- Q-ORIENT-4: Is orientation reset always explicit, or can it be inferred safely?

These questions are deliberately excluded from the core protocol to avoid freezing a single interpretation of continuity. Different implementations may explore different answers as long as the replay invariant stays intact.

## Trajectories & Admissible Futures

Open questions (non-normative):

- Q-FUTURE-1: Optimal branching factor for admissible futures
- Q-FUTURE-2: Trade-offs between exploration breadth and determinism
- Q-FUTURE-3: When should futures collapse, merge, or expire? Branch collapse/merge policies are implementation-defined and MUST NOT affect core conformance.
- Q-FUTURE-4: How to visualize or serialize trajectories without leaking semantics?
- Q-FUTURE-5: How to store or replay traces without PII or prompt leakage? What redaction strategies keep traces safe for audits?

The protocol only defines *that* trajectories exist, not *how* they are scored or explored, because embedding scoring would break neutrality across models and runtimes.

## Determinism vs Adaptivity

Open questions (non-normative):

- Q-DETERMINISM-1: How much non-determinism is acceptable before coherence degrades?
- Q-DETERMINISM-2: Can adaptive systems remain auditable without freezing behavior?
- Q-DETERMINISM-3: Where is the boundary between protocol guarantees and model freedom?

LTP guarantees continuity, not optimality, because choosing “better” paths belongs to products and would undermine deterministic replay.

## Experimental Directions

Safe areas for experimentation:

- routing strategies
- orientation metrics
- decay functions
- visualization layers
- human-in-the-loop controls

Any such experimentation MUST NOT modify the normative core, because altering the core would break replayability and cross-implementation comparability.

## Design Intent

LTP is intentionally incomplete by design.

Its purpose is not to answer all questions,
but to provide a stable axis around which answers can evolve
without fragmenting continuity.

## Why LTP Must Remain Small

Protocols gain power through stability, not scope.
Every additional responsibility increases semantic ambiguity
and reduces reproducibility.

LTP remains intentionally minimal to preserve:
- deterministic replay
- cross-model neutrality
- long-term interpretability

## How to contribute

If you want to explore any of these questions, open an issue or submit an RFC in `governance/`.

LTP is complete not when it can do more, but when nothing essential can be removed without breaking it.

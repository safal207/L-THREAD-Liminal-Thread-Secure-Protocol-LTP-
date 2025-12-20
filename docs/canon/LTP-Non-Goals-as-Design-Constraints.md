# PR 200 — Non-Goals as Design Constraints: Why LTP Cannot (and Should Not) Be Extended

> This document defines non-goals of LTP as first-class design constraints.
> These constraints are not limitations of the protocol,
> but guarantees of its composability, neutrality, and long-term interoperability.

---

## 1. Introductory Invariant

The constraints below are canonical: they exist to keep LTP composable under change.
They are framed as design constraints, not as expressions of scarcity or lack.

---

## 2. Key Principle

> LTP is intentionally minimal.
>
> Any feature that requires interpretation, optimization, or goal synthesis
> must exist above the protocol layer, not within it.

This principle is the shield that keeps LTP stable when products evolve.

---

## 3. Non-Goals (as Design Constraints)

### 3.1 LTP does not define intelligence

LTP does not model intelligence, reasoning, or cognition.
It does not evaluate correctness, optimality, or semantic meaning of actions.

### 3.2 LTP does not implement learning

LTP does not train, adapt, or update behavior based on outcomes.
Learning systems may consume LTP traces,
but learning is strictly external to the protocol.

### 3.3 LTP does not optimize outcomes

LTP does not select optimal paths, maximize rewards, or minimize loss.
It records admissible trajectories, not preferred ones.

### 3.4 LTP does not contain emotional or psychological models

LTP does not encode affect, emotion, intention, or mental states.
Such concepts may be layered above LTP,
but are explicitly out of scope for the protocol.

---

## 4. Why Extension Would Break LTP

Extending LTP with interpretation, scoring, or goal semantics would collapse the separation between protocol and product.
This would:

- break determinism,
- introduce hidden coupling,
- invalidate conformance guarantees,
- fragment interoperability.

---

## 5. Canonical Escape Hatch

Systems requiring semantics, optimization, or agency must implement such capabilities above LTP, using LTP only as a continuity and orientation substrate.
The protocol remains neutral; the product layer remains free to innovate.

---

## 6. Final Formula

> LTP is not a foundation model.
> It is a foundation constraint.

---

## 7. Relation to Prior PRs

- PR 195 defined explicit limits and boundaries for LTP.
- PR 199 documented common misuse patterns and how they violate the core.
- PR 200 explains why the boundaries cannot be relaxed without dissolving the protocol.

Together they keep LTP closed under extension and open under composition.

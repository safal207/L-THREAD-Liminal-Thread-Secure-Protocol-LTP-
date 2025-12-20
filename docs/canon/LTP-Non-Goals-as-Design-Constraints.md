# LTP — Non-Goals as Design Constraints (Canonical)

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
> MUST be implemented above the protocol layer, not within it.

Core state MUST remain deterministic and replayable across implementations and over time.

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

### 3.5 LTP does not provide observability storage

LTP describes how traces are structured and replays remain coherent.
It does not dictate storage backends (e.g., Loki, S3, OpenTelemetry, ClickHouse).

### 3.6 LTP does not define transport security

LTP is agnostic to TLS, mTLS, WSS, QUIC, or other transport security choices.
Crypto policy, ciphers, and key management live below or beside the protocol, not inside it.

### 3.7 LTP does not orchestrate agents

LTP is not a scheduler, workflow engine, or queue manager.
Agent coordination, retries, and backpressure belong to orchestration layers above LTP.

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

Use LTP to record: present → focus_node → admissible_branches (deterministic, replayable).
Implement in your product: scoring, selection, learning, UX, policy, and transport choices.

---

## 6. Final Formula

> LTP is not a foundation model.
> It is a foundation constraint.

---

## 7. Relation to Prior PRs

- “Limits of LTP (Non-Goals & Boundaries)” defines explicit limits and boundaries for LTP.
- “Misuse Patterns: How LTP Is Commonly Broken (And Why This Is Not Allowed)” documents common misuse patterns and how they violate the core.
- The companion document explains why the boundaries cannot be relaxed without dissolving the protocol.

Together they keep LTP closed under extension and open under composition.

See also:

- `docs/canon/LTP-Limits-of-LTP.md`
- `docs/canon/LTP-Products-on-LTP-Without-Violating-Core.md`
- `docs/canon/LTP-Misuse-Patterns.md`

---

## Operational Rule of Thumb

- LTP defines **trace shape**, not **trace storage**.
- LTP is **transport-agnostic**, not a **security policy**.
- LTP provides **continuity guarantees**, not **agent orchestration**.
- LTP governs **orientation over time**, not **decision correctness**.

If a proposed extension violates any of the above, it does not belong in the LTP core.

---

This document is canonical.
Implementation details may evolve; these constraints must not.

---

## Design Invariant

If a system:
- hides orientation transitions,
- merges prediction with routing,
- makes continuity implicit,

it is not an LTP-compatible system,
even if it uses LTP terminology.

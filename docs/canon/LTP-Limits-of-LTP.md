# PR 275 — Limits and Non-Goals of LTP

## Why this document exists

LTP is a protocol, not a platform. This document exists to prevent misclassification of LTP as an agent, policy engine, or decision system. By codifying what LTP does **not** do, we reduce scope creep, prevent category errors, and protect the protocol’s core invariants.

---

## 1. Hard limits (by design)

These constraints are rooted in the orientation invariant and cannot be relaxed without breaking LTP.

### 1.1 LTP does not make decisions

LTP never selects an action, outcome, or “best” future. It only defines:

- admissible trajectories
- orientation constraints
- continuity across transitions

If you need a system to choose — you are operating above LTP.

### 1.2 LTP does not perform inference

LTP does not:

- generate tokens
- rank model outputs
- evaluate semantic correctness

All inference happens outside the protocol. Errors are allowed; loss of orientation is not.

### 1.3 LTP is not a memory database

LTP does not store:

- embeddings
- knowledge graphs
- long-term semantic memory

It stores orientation state, not content. Using LTP as a memory layer breaks determinism and replayability.

---

## 2. Explicit non-goals

These are deliberate exclusions: areas where LTP could be extended by other layers but must not be conflated with the protocol itself.

### 2.1 LTP is not an agent framework

LTP does not manage:

- task scheduling
- tool calling
- retries or planning loops

It can support agent systems, but it never replaces them.

### 2.2 LTP is not an orchestration layer

LTP does not:

- route network traffic
- balance workloads
- manage distributed execution

It operates at the orientation layer, not the execution layer.

### 2.3 LTP is not a safety or alignment system

LTP does not define:

- ethical rules
- alignment objectives
- value systems

It only ensures that whatever rules exist are applied consistently over time.

---

## 3. Anti-patterns (negative examples)

If your implementation does any of the following, it is no longer LTP-compliant:

- ❌ Selecting or ranking actions inside LTP frames or orientation state.
- ❌ Treating orientation primitives as model attention, prompt-weaving, or retrieval logic.
- ❌ Persisting embeddings, knowledge graphs, or long-term content inside LTP state.
- ❌ Embedding business rules, policy decisions, or optimization logic into protocol semantics.

If your design requires any of the above, LTP is the wrong abstraction.

---

## 4. Why these limits matter

These limits protect LTP core invariants:

- orientation continuity
- deterministic replay
- model-agnostic neutrality

Innovation lives above the protocol, not inside it. LTP defines where you are — not what you should do.

---

## 5. Summary

- Protection against misuse
- Clear mental model for contributors
- Long-term protocol stability
- Reduced governance and review friction

LTP remains intentionally small. Its power comes not from what it does — but from what it refuses to do.

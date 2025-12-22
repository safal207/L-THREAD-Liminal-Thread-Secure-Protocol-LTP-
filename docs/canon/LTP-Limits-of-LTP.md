# Limits & Non-Goals of LTP (Refined)

## Why this document exists

LTP is a protocol, not a platform.

This document exists to prevent category errors — attempts to use LTP for problems it was not designed to solve.
These limits are not temporary gaps; they are intentional design constraints.

They protect the core invariants of the protocol.

---

## 1. Hard Limits (By Design)

These are fundamental limits.
LTP cannot perform these functions even in theory, without violating its core guarantees.

### 1.1 LTP does not make decisions

LTP never selects an action, outcome, or “best” future.

It only defines:

- admissible trajectories
- orientation constraints
- continuity across transitions

If you need a system to choose — you are operating above LTP.

---

### 1.2 LTP does not perform inference

LTP does not:

- generate tokens
- rank model outputs
- evaluate semantic correctness

All inference happens outside the protocol.

LTP only records and constrains how inference results may be used over time.

---

### 1.3 LTP is not a memory database

LTP does not store:

- embeddings
- knowledge graphs
- long-term semantic memory

It stores orientation state, not content.

Using LTP as a memory layer breaks determinism and replayability.

---

## 2. Explicit Non-Goals

These are things LTP deliberately does not try to solve, even though they may appear adjacent.

### 2.1 LTP is not an agent framework

LTP does not manage:

- task scheduling
- tool calling
- retries or planning loops

It can support agent systems, but it never replaces them.

---

### 2.2 LTP is not an orchestration layer

LTP does not:

- route network traffic
- balance workloads
- manage distributed execution

It operates at the orientation layer, not the execution layer.

---

### 2.3 LTP is not a safety or alignment system

LTP does not:

- ethical rules
- alignment objectives
- value systems

It only ensures that whatever rules exist are applied consistently over time.

---

## 3. Anti-Patterns

The following uses are explicitly incorrect:

❌ Using LTP to select or rank actions
❌ Treating orientation as model attention
❌ Using LTP as a persistence layer for content
❌ Encoding business logic directly into the protocol

If your design requires any of the above, LTP is the wrong abstraction.

---

## 4. Relation to Core Invariants

These limits exist to protect LTP’s core invariants:

- Orientation continuity
- Deterministic replay
- Model-agnostic neutrality
- Explainable state transitions

Violating the limits inevitably breaks at least one invariant.

---

## 5. Canonical Boundary Statement

> LTP defines where you are — not what you should do.

If a system needs LTP to “decide”, it is built at the wrong layer.

---

## 6. Architectural Guidance

Correct usage pattern:

```
[ Models / Agents / Policies ]
            ↑
     (decisions & actions)
            ↑
        [ LTP Core ]
   (orientation & continuity)
```

Innovation lives above the protocol, not inside it.

---

## What this gives the project

- Protection against misuse
- Clear mental model for contributors
- Long-term protocol stability
- Reduced governance and review friction

---

## End note

LTP remains intentionally small.

Its power comes not from what it does —
but from what it refuses to do.

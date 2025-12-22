# PR 252 — Limits and Non-Goals of LTP

## Why this document exists

LTP is a protocol, not a platform.

This document exists to prevent category errors — attempts to use LTP for problems it was not designed to solve.
These limits are not temporary gaps; they are intentional design constraints.

They protect the core invariants of the protocol.

---

## 1. Hard Limits (By Design)

## 2. Hard Limits (By Design)

These constraints are rooted in the orientation invariant and cannot be relaxed without breaking LTP.

### 1.1 LTP does not make decisions

LTP never selects an action, outcome, or “best” future.

It only defines:

- admissible trajectories
- orientation constraints
- continuity across transitions

If you need a system to choose — you are operating above LTP.

---

### 1.2 LTP does not perform inference

### 4) Not an orchestration framework
LTP does not:

- generate tokens
- rank model outputs
- evaluate semantic correctness

All inference happens outside the protocol.

If you need LTP to make decisions, you are building the wrong layer.

Errors are allowed.
Loss of orientation is not.

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

LTP does not define:

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

### 2.6 On physical, quantum, and metaphorical interpretations

## 4. Relation to Core Invariants

These limits exist to protect LTP’s core invariants:

Any such interpretations are optional, external, and strictly out of scope.

---

## 3. Orientation Invariant (Clarification)

> LTP defines where you are — not what you should do.

If a system needs LTP to “decide”, it is built at the wrong layer.

---

## 6. Architectural Guidance

## 4. Explicit Non-Goals

These are deliberate exclusions: areas where LTP could be extended by other layers but must not be conflated with the protocol itself.

- Providing governance for autonomous agents.
- Dictating safety policies or norms for decisioning systems.
- Acting as a product framework for UX, memory strategies, or RL pipelines.
- Serving as an “AI platform” or “agent OS”.
- Replacing storage, orchestration, or model selection systems.

LTP defines where you are — not what you should do.

## 5. Anti-Patterns (Negative Examples)

The following misuses violate the design intent and should be rejected at review time:

- ❌ Using LTP to select actions directly.
- ❌ Using LTP as a memory database.
- ❌ Treating orientation as model attention or prompt-weaving logic.

## 6. Why These Limits Matter

Innovation lives above the protocol, not inside it.

---

## What this gives the project

- Protection against misuse
- Clear mental model for contributors
- Long-term protocol stability
- Reduced governance and review friction

These limits exist to protect LTP core invariants:

- Orientation continuity,
- Deterministic replay,
- Model-agnostic neutrality.

## 7. Summary

## End note

LTP remains intentionally small.

Its power comes not from what it does —
but from what it refuses to do.

---

## Что дальше (рекомендую)

После этого PR логично сделать один из двух:

- PR 194 introduces the orientation invariant.
- PR 252 codifies what the invariant is *not*, keeping the standard narrowly scoped.
- Together they mirror patterns like TCP + what TCP does not guarantee, POSIX + undefined behavior, and RFC + security considerations.

Бро, если хочешь — в следующем шаге могу:

- привести это в IETF/RFC-тон (ещё суше),
- или наоборот — сделать короткую версию для README.

Скажи формат — и идём дальше.

# PR 252 — Limits and Non-Goals of LTP

> A protocol becomes trustworthy not when it explains everything,
> but when it clearly states what it does not attempt to explain.

## 1. Purpose of This Document

This document defines the explicit limits of the Liminal Thread Protocol (LTP).

Its goal is to:

- prevent misinterpretation,
- avoid category errors,
- and preserve LTP as a neutral infrastructure standard, not a theory of mind, physics, or meaning.

LTP is intentionally narrow in scope.

## 2. Hard Limits (By Design)

These constraints are rooted in the orientation invariant and cannot be relaxed without breaking LTP.

### 2.1 LTP is NOT a cognitive model

LTP does not:

- model consciousness,
- simulate awareness,
- represent emotions, intentions, or beliefs as mental states.

Any cognitive interpretation exists above the protocol layer.

> LTP standardizes continuity of orientation,
> not cognition itself.

### 2.2 LTP is NOT a decision-making system

LTP does not:

- choose actions,
- optimize outcomes,
- rank futures as “better” or “worse”.

It only defines which futures are admissible under constraints.

If you need LTP to make decisions, you are building the wrong layer.

Errors are allowed.
Loss of orientation is not.

### 2.3 LTP is NOT a prediction engine

LTP does not:

- predict the future,
- estimate probabilities as truth,
- replace statistical or ML-based inference.

Future branches are routes, not forecasts.

### 2.4 LTP is NOT a memory store

LTP does not:

- store long-term knowledge,
- replace databases or vector stores,
- act as retrieval infrastructure.

It references snapshots, not memories.

### 2.5 LTP is NOT an orchestration framework

LTP does not:

- manage agents,
- schedule tasks,
- coordinate execution.

It remains agnostic to orchestration layers.

### 2.6 On physical, quantum, and metaphorical interpretations

LTP does not assert:

- a physical substrate of orientation,
- a quantum or string-theoretic basis,
- any claims about reality, matter, or cosmology.

Any such interpretations are optional, external, and strictly out of scope.

> LTP does not describe what orientation is.
> It standardizes how orientation is represented and preserved.

## 3. Orientation Invariant (Clarification)

To avoid ambiguity, the following definition applies:

> **Orientation Invariant**
> A replay-stable state representation that remains coherent across transitions and can be deterministically restored to evaluate admissible futures.

Notes:

- “Frozen” means replayable, not immutable.
- Orientation may change; the invariant is the ability to restore and evaluate, not the content itself.

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

Without explicit limits, LTP risks becoming:

- a philosophical claim,
- a cognitive theory,
- or an overextended abstraction.

With limits, LTP remains:

- auditable,
- testable,
- composable,
- and suitable for standardization.

These limits exist to protect LTP core invariants:

- Orientation continuity,
- Deterministic replay,
- Model-agnostic neutrality.

## 7. Summary

LTP exists to solve one problem:

> Preserving coherence across time in systems that would otherwise collapse into stateless inference.

Everything else is intentionally left outside the protocol.

---

> LTP does not explain intelligence.
> It prevents intelligence from losing its place in time.

## How this reinforces PR 194

- PR 194 introduces the orientation invariant.
- PR 252 codifies what the invariant is *not*, keeping the standard narrowly scoped.
- Together they mirror patterns like TCP + what TCP does not guarantee, POSIX + undefined behavior, and RFC + security considerations.

Result: reduced misinterpretation, higher trust for implementers and investors, and a clearer path to future security and formal guarantees.

Future follow-on proposals:

- PR 196: Security & Abuse Considerations
- PR 196: Formal Guarantees vs Undefined Behavior

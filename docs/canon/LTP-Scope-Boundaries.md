# PR 250 — LTP Scope Boundaries (Non-Goals & Limits)

> A protocol becomes trustworthy not when it explains everything,
> but when it clearly states what it does not attempt to explain.

## 1. Purpose of This Document

This document defines the explicit limits of the Liminal Thread Protocol (LTP).

Its goal is to:

- prevent misinterpretation,
- avoid category errors,
- and preserve LTP as a neutral infrastructure standard, not a theory of mind, physics, or meaning.

These limits exist to preserve the integrity of the Frozen Core. Violating them would directly conflict with the normative contract.

LTP is intentionally narrow in scope.

## 2. Scope Legend

- **Out of scope** — will not be implemented by LTP. These are principled exclusions.
- **Open question** — may be explored externally (see `docs/LTP-OPEN-QUESTIONS.md` from PR #249) without changing the core.
- **Implementation-defined** — allowed variation for deployments; informative but non-normative for LTP.

## 3. What LTP Explicitly Does NOT Do

### 3.1 LTP is NOT a cognitive model

LTP does not:

- model consciousness,
- simulate awareness,
- represent emotions, intentions, or beliefs as mental states.

Any cognitive interpretation exists above the protocol layer.

> LTP standardizes continuity of orientation,
> not cognition itself.

### 3.2 LTP is NOT a decision-making system

LTP does not:

- choose actions,
- optimize outcomes,
- rank futures as “better” or “worse”.

It only defines which futures are admissible under constraints.

Errors are allowed.
Loss of orientation is not.

### 3.3 LTP is NOT a prediction engine

LTP does not:

- predict the future,
- estimate probabilities as truth,
- replace statistical or ML-based inference.

Future branches are routes, not forecasts.

### 3.4 LTP is NOT a memory store

LTP does not:

- store long-term knowledge,
- replace databases or vector stores,
- act as retrieval infrastructure.

It references snapshots, not memories.

### 3.5 LTP is NOT an orchestration framework

LTP does not:

- manage agents,
- schedule tasks,
- coordinate execution.

It remains agnostic to orchestration layers.

## 4. On Physical, Quantum, and Metaphorical Interpretations

LTP does not assert:

- a physical substrate of orientation,
- a quantum or string-theoretic basis,
- any claims about reality, matter, or cosmology.

Any such interpretations are:

- optional,
- external,
- and strictly out of scope.

> LTP does not describe what orientation is.
> It standardizes how orientation is represented and preserved.

## 5. What Does NOT Violate These Limits

Using LTP traces as input to ML systems is allowed, so long as LTP itself does not learn, adapt, or mutate its Frozen Core semantics. Ecosystem tooling may evolve; the protocol remains frozen.

## 6. Orientation Invariant (Clarification)

To avoid ambiguity, the following definition applies:

> **Orientation Invariant**
> A replay-stable state representation that remains coherent across transitions and can be deterministically restored to evaluate admissible futures.

Notes:

- “Frozen” means replayable, not immutable.
- Orientation may change; the invariant is the ability to restore and evaluate, not the content itself.

(This clarifies the usage introduced in PR 194.)

## 7. Why These Limits Matter

Without explicit limits, LTP risks becoming:

- a philosophical claim,
- a cognitive theory,
- or an overextended abstraction.

With limits, LTP remains:

- auditable,
- testable,
- composable,
- and suitable for standardization.

## 8. Summary

LTP exists to solve one problem:

> Preserving coherence across time in systems that would otherwise collapse into stateless inference.

Everything else is intentionally left outside the protocol.

---

> LTP does not explain intelligence.
> It prevents intelligence from losing its place in time.

## How this reinforces PR 194

- PR 194 introduces the orientation invariant.
- PR 250 codifies what the invariant is *not*, keeping the standard narrowly scoped.
- Together they mirror patterns like TCP + what TCP does not guarantee, POSIX + undefined behavior, and RFC + security considerations.

Result: reduced misinterpretation, higher trust for implementers and investors, and a clearer path to future security and formal guarantees.

Future follow-on proposals:

- PR 196: Security & Abuse Considerations
- PR 196: Formal Guarantees vs Undefined Behavior

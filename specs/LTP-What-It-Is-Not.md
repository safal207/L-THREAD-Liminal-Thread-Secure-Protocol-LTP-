# What LTP Is Not (Non-Normative)

This document clarifies what the Liminal Thread Protocol (LTP) explicitly is **not**.

Its purpose is to prevent category errors, overloading expectations,
and architectural misuse of the protocol.

---

## LTP is NOT a Recommendation System

LTP does not aim to predict user preferences,
optimize engagement,
or maximize conversion metrics.

It does not rank content by popularity, similarity, or historical behavior.

**Hard Limit:**
- Orientation is not recommendation.
- Branches are not suggestions.
- Confidence is not probability.

---

## LTP is NOT a Machine Learning Framework

LTP does not require:
- training datasets
- model weights
- gradient descent
- reinforcement learning
- neural architectures

ML or LLM components MAY be used by implementations,
but are entirely optional and non-normative.

---

## LTP is NOT a Data Storage System

LTP does not define:
- databases
- schemas
- persistence guarantees
- replication strategies

Frames are transient by design.
State may be forgotten.
Silence is meaningful.

---

## LTP is NOT a Workflow Engine

LTP does not enforce:
- step-by-step processes
- state machines
- task pipelines
- orchestration graphs

Flows may pause, branch, or dissolve without completion.

---

## LTP is NOT an Optimization Protocol

LTP does not optimize for:
- speed
- throughput
- efficiency
- minimal latency
- maximal accuracy

Graceful degradation is preferred over optimal performance.

---

## LTP is NOT an Autonomous Decision Maker

**Decision-Layer Warning:**
LTP does not make decisions.
It does not act on behalf of users or agents.

It provides orientation, not authority.
Responsibility remains external.

---

## LTP is NOT a Replacement for Human Judgment

LTP does not remove ambiguity.
It does not eliminate uncertainty.
It does not guarantee correctness.

Its purpose is to *make uncertainty navigable*, not disappear.

---

## Anti-Patterns & Canonical Guidance

The following patterns are considered violations of the protocol's spirit and design goals.

### Enforcing Outcomes
LTP provides a map of possible futures (branches), but does not mandate which path must be taken.
*Anti-Pattern:* Blocking a thread until a specific "correct" response is received.

### Hiding Uncertainty
LTP thrives on exposing ambiguity and multiple possibilities.
*Anti-Pattern:* Artificially inflating confidence scores or removing low-probability branches to present a clean but false certainty.

### Collapsing Plurality
LTP supports divergent paths and "plural" states.
*Anti-Pattern:* Reducing a complex set of branches into a single "best answer" summary without preserving the option to explore alternatives.

---

## Core Invariants

These limits are necessary to preserve the foundational principle of LTP:

**Orientation over Answers.**

By restricting the protocol's scope (no decisions, no optimization, no storage), we ensure it remains a neutral, lightweight layer for context and orientation.

---

## Summary

LTP is a protocol for **orientation in uncertainty**.

Everything else is optional.

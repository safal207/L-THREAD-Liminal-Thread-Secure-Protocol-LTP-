# RFC-0001: Orientation over Answers

- **Status:** Draft
- **Category:** Foundational
- **Applies to:** LTP v0.x and beyond

## Abstract

This document defines the foundational principle of the Liminal Thread Protocol (LTP): **orientation is more scalable, resilient, and truthful than answers.**

LTP does not attempt to compute or deliver correct answers. Instead, it provides a protocol for maintaining orientation — a shared, explainable sense of position, direction, and possible transitions — across humans, agents, and systems.

## 1. Motivation

Modern systems are built around answers:
- recommendations
- predictions
- decisions
- classifications

These approaches assume:
- sufficient data
- stable objectives
- centralized truth
- controllable environments

In practice, these assumptions fail. Systems become:
- brittle under uncertainty
- opaque under scale
- expensive in data and tuning
- misaligned with human sense-making

LTP emerges from a different premise:
> In complex, evolving systems, orientation matters more than answers.

## 2. Orientation vs Answers

**Answers:**
- are point estimates
- collapse uncertainty
- age quickly
- require authority to validate
- incentivize overfitting

**Orientation:**
- preserves uncertainty
- supports multiple plausible paths
- adapts continuously
- is explainable by construction
- scales across actors and time

LTP treats absence, ambiguity, and silence as first-class signals, not errors.

## 3. Protocol Implications

From this principle follow several non-negotiable design choices:

- **Multiple branches over single outputs:** Routing returns possibilities, not commands.
- **Explainability over optimization:** Decisions must be traceable, not merely performant.
- **Graceful degradation over correctness:** Reduced depth is acceptable; collapse is not.
- **Flow before storage:** Orientation exists before databases, models, or persistence layers.
- **Silence is meaningful:** No forced responses when signals are absent.

## 4. Human and Agent Symmetry

LTP is intentionally designed to be usable by:
- humans
- software agents
- hybrid systems

The protocol does not assume:
- learning by instruction
- reinforcement-driven optimization
- centralized training

Instead, it supports self-learning through orientation. This aligns with a fundamental constraint:
> You cannot teach — you can only learn.

LTP provides the conditions for learning, not the outcome.

## 5. Non-Goals

LTP explicitly does not aim to:
- replace machine learning
- provide recommendation engines
- enforce behavioral outcomes
- encode moral or business logic
- maximize engagement or efficiency

Those concerns may be layered on top of LTP, but are not part of its core.

## 6. Why a Protocol

Protocols outlive implementations. By fixing a minimal, orientation-first contract, LTP enables:
- diverse implementations
- competitive ecosystems
- independent evolution
- service markets
- long-term stability

LTP is designed to remain useful even if:
- all current SDKs are rewritten
- current maintainers disappear
- new paradigms replace today’s models

## 7. Conclusion

LTP asserts a simple but radical idea:
> The future does not belong to systems that know the answers, but to systems that remain oriented while answers change.

RFC-0001 establishes this principle as the philosophical and architectural root of the Liminal Thread Protocol.

## Status

This RFC is informational but foundational. All future specifications, governance documents, and conformance requirements are expected to be compatible with this principle.

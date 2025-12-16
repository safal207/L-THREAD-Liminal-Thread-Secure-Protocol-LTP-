# LTP Adoption Profiles v0.1

## Introduction

LTP intentionally separates protocol invariants from adoption patterns.

Adoption Profiles describe how different actors use LTP, not what LTP is.
These profiles are:

- **Non-normative**
- **Non-exclusive**
- **Composable**
- **Evolvable without protocol changes**

Adoption Profiles describe *how value emerges* from LTP in different contexts,
without constraining implementation or governance.

This document establishes standard reference patterns for LTP usage across different scales and purposes.

---

## Profile 1: Solo Developer / Mono-Architect

**Who**
- Independent developers
- Researchers
- Solo architects

**Goal**
- Cognition
- Orientation
- Decision making
- Minimal infrastructure

**Characteristics**
- Single node architecture
- Local or ephemeral storage
- Heavy focus on `orientation`, `route_request`, and `focus_snapshot`
- Human = Agent = Operator

**Value Proposition**
> LTP becomes externalized cognition, rather than a recommendation system.

---

## Profile 2: Startup / Product Team

**Who**
- Small teams
- AI-first products
- Experimental services

**Goal**
- Decision navigation
- Graceful degradation without crashing
- Explainability

**Characteristics**
- Multiple nodes
- Routing implemented as a service
- Usage of `route_response` with multiple branches
- HUD (Heads-Up Display) used as a shared interface for the team

**Value Proposition**
> LTP replaces brittle pipelines and ad-hoc decision logic.

---

## Profile 3: Enterprise / Platform

**Who**
- Corporations
- Large-scale platforms (e.g., streaming providers, cloud services)

**Goal**
- Resilience
- Predictability
- Decision auditing
- Reducing data science operational costs

**Characteristics**
- Large number of nodes
- Strict conformance adherence
- Emphasis on determinism and explainability
- LTP acts as a decision fabric, not an ML model

**Value Proposition**
> LTP reduces dependency on brittle, data-heavy decision pipelines.

---

## Profile 4: Research / Academia

**Who**
- Universities
- Research groups
- Open Science initiatives

**Goal**
- Study of decision-making processes
- Reproducibility
- Formalization of "meaning" and context

**Characteristics**
- Simulations
- Stream replays
- Analysis of Canonical Flow
- Minimal infrastructure requirements

**Value Proposition**
> LTP serves as a laboratory protocol, not a commercial product.

---

## Profile 5: Autonomous Agents / AI Systems

**Who**
- Agentic systems
- Autonomous AI
- Multi-agent environments

**Goal**
- Self-diagnosis
- Orientation
- Coordination without central control

**Characteristics**
- Agent = Node
- Usage of `heartbeat` as state
- `orientation` used as self-model
- `routing` used as future selection, not action execution

**Value Proposition**
> LTP is the agent's home/habitat, not a reinforcement learning environment.

---

## Guiding Principles

> **Adoption Profiles do not lock behavior and do not impose restrictions.**

Any implementation may:
- Correspond to multiple profiles
- Evolve between profiles over time
- Create new profiles without changing the standard

---

## Economic Note (Non-Normative)

LTP profiles reflect different cost surfaces:
- Reduced data retention
- Delayed decision materialization
- Lower coordination overhead

Value is created not by prediction accuracy, but by timely orientation and graceful degradation.

---

## Governance Context

- Profiles are **not** approved by the Advisory Board.
- Profiles do **not** require an RFC process.
- Profiles may be proposed by **any** participant.

This document represents the *culture of usage*, not protocol policy.

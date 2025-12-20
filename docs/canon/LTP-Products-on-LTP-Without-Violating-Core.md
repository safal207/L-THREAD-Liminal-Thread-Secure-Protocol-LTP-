# PR 196 — How to Build Products on LTP Without Violating the Core

**Any product built on LTP may add behavior, but MUST preserve the continuity guarantees of the protocol unchanged.**

Purpose: explain how to design systems, products, and services on top of LTP while preserving the invariants defined in the LTP Core and in **Limits of LTP (PR 195)**. It exists to enable innovation without erosion.

## 1. The Core Rule

> LTP defines continuity constraints, not behavior. Products **MAY** extend behavior. Products **MUST NOT** redefine continuity.

If this rule is violated, a product is not compatible with LTP—even if it “works.”

## 2. Allowed Extension Zones

### ✅ Zone A — Product Logic

You may implement:

- agents
- workflows
- policies
- business rules
- UX flows
- decision heuristics

As long as:

- LTP frames are treated as immutable inputs
- orientation is read, not overwritten

### ✅ Zone B — Interpretation Layers

You may build:

- explainability UIs
- visualizations (graphs, timelines)
- scoring / ranking of admissible futures
- dashboards (DevOps, audit, compliance)

As long as:

- interpretation is derived, not injected
- LTP remains the source of truth for continuity

### ✅ Zone C — Storage & Transport

You may attach:

- databases
- message queues
- ledgers
- caches
- streams

As long as:

- storage does not redefine orientation
- replay always reconstructs the same trajectory

## 3. Forbidden Moves

### ❌ Do NOT mutate orientation

Products **MUST NOT**:

- rewrite identity
- “correct” drift history
- collapse branches silently
- inject hidden state

If orientation changes, it must happen via canonical LTP transitions only.

Example of violation: rewriting drift history to “clean up” agent behavior after a failure.

### ❌ Do NOT overload LTP with intent

LTP **MUST NOT** be used as:

- a recommendation engine
- a planner
- a decision authority
- a memory substitute

If your product “needs” this — it belongs above, not inside, LTP.

### ❌ Do NOT hide discontinuities

Products **MUST NOT**:

- mask resets
- smooth over broken transitions
- silently restart threads

Discontinuity is a signal, not a bug.

## 4. The Spider & Turtle Rule

> LTP is the Thread. Products may be Spiders or Turtles — but never Threads.

- Spider systems (graphs, agents, orchestration) may traverse the thread.
- Turtle systems (storage, memory, ledgers) may persist snapshots.

But neither may redefine the thread itself.

## 5. Canonical Product Patterns

These patterns are illustrative, not exhaustive.

### Pattern 1 — Orientation-aware Agent

Agent:

- reads orientation
- proposes actions
- logs outcomes back as transitions

Agent does **NOT**:

- decide continuity
- override drift

### Pattern 2 — Audit-first Platform

Platform:

- stores LTP traces
- replays transitions
- flags constraint violations

Platform does **NOT**:

- fix history
- rewrite outcomes

### Pattern 3 — Human-in-the-Loop

Human:

- observes admissible futures
- selects actions
- remains inside the same thread

Human does **NOT**:

- reset identity
- fork without explicit transition

## 6. Relationship to PR 195

> This document complements **Limits of LTP**.

- PR 195 defines what LTP is not.
- PR 196 defines how to build without crossing those limits.

Together they define a stable core and an open ecosystem.

## 7. Final Principle

> Products evolve. Protocols endure. LTP exists to ensure the second without blocking the first.

---

Strategic outcomes:

- 🔒 protection against feature creep
- 🧠 clarity for contributors
- 🏗️ freedom for products
- 🧭 preservation of project orientation
- 🤝 easier conversations with architects and investors

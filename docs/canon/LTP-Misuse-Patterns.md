# PR 199 — Misuse Patterns: How LTP Is Commonly Broken (And Why This Is Not Allowed)

> This document describes common misuse patterns observed when teams attempt to build products on top of LTP.
> These patterns are listed not to restrict innovation, but to preserve the stability barrier of the LTP Core.

LTP is intentionally minimal, non-opinionated, and resistant to extension.
Most failures occur not because the protocol is insufficient, but because its role is misunderstood.

---

## Stability Barrier (Context)

LTP Core acts as a stability barrier:

> Changes may accumulate outside the core,
> but must never propagate inward.

This barrier ensures:

- continuity across time
- reproducibility across systems
- interoperability across independently developed products

Violating this barrier compromises all three.

---

## ❌ Misuse Pattern #1: Embedding Business Logic into Orientation

### Description
Using LTP orientation fields to encode domain-specific rules, goals, or decisions.

### Examples

- Encoding task completion logic in `focus_momentum`
- Treating `admissible_futures` as a decision tree
- Injecting product-specific semantics into identity fields

### Why this breaks LTP

- Orientation becomes opinionated
- Trajectories stop being portable
- Replay loses meaning outside the original system

### Correct usage

- Business logic lives above LTP
- LTP only records state continuity, not intent or policy

---

## ❌ Misuse Pattern #2: Treating LTP as a Memory Store

### Description
Using LTP as a long-term storage system, vector database, or contextual cache.

### Examples

- Storing conversation history inside LTP state
- Encoding embeddings or raw content in orientation snapshots
- Expecting LTP to “remember” instead of reference

### Why this breaks LTP

- State size becomes unbounded
- Determinism degrades
- Memory semantics leak into the protocol layer

### Correct usage

- LTP references external memory
- It tracks how orientation evolves, not what content exists

---

## ❌ Misuse Pattern #3: Coupling LTP Lifecycle to Agent Runtime

### Description
Binding the lifetime of an LTP thread to a specific process, model instance, or agent runtime.

### Examples

- Destroying orientation on agent restart
- Initializing LTP inside agent constructors
- Assuming “one agent = one thread”

### Why this breaks LTP

- Continuity collapses on failure
- Replay becomes impossible
- Cross-runtime handoff is lost

### Correct usage

- LTP outlives agents
- Agents attach/detach from orientation
- Failures update drift, not erase state

---

## ❌ Misuse Pattern #4: Using LTP to Choose Actions

### Description
Treating LTP as a recommendation engine or decision selector.

### Examples

- Picking the “best” future branch automatically
- Interpreting confidence scores as commands
- Expecting LTP to output actions

### Why this breaks LTP

- Orientation collapses into control logic
- Determinism is replaced by policy
- Explainability is lost

### Correct usage

> LTP does not choose actions.
> It maintains orientation so actions remain coherent over time.

---

## ❌ Misuse Pattern #5: Extending the Core Instead of Building Around It

### Description
Modifying or extending LTP Core to fit a specific product or use case.

### Examples

- Adding custom fields to the core schema
- Forking core logic to “just support one feature”
- Making core behavior conditional on environment

### Why this breaks LTP

- Forks fragment the protocol
- Conformance becomes meaningless
- Ecosystem compatibility is lost

### Correct usage

- Extend around the core
- Keep the core frozen
- Innovation happens at the edges

---

## Summary

Most misuse patterns share the same root cause:

> Confusing orientation with decision,
> or continuity with control.

LTP exists to solve one problem precisely:

> Preserve coherence across time, failures, retries, and change.

Everything else belongs elsewhere.

---

## Relation to PR #198

PR #198 defines what must not change.
PR #199 documents how it is most often violated.

Together, they establish:

- a protected core
- a clear adoption boundary
- a shared mental model for contributors and integrators

---

## Final Principle (Reiterated)

> Prediction produces output.
> Orientation governs coherence.

---

## Future Follow-On Options

If needed, next steps could include:

- PR #200: “LTP Constitution” (1 page, 5 invariants)
- PR #200: “Conformance Philosophy” — how tests reflect protocol values
- Or a pause to let the system settle and collect external feedback

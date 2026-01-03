# Who LTP Is For and How to Get Started

## Who LTP Is For

LTP is designed for engineers building systems where continuity, determinism, and auditability matter more than producing locally optimal answers.

Typical users include:

Platform & DevTools engineers operating long-running or stateful AI systems

System architects designing workflows that must remain coherent across retries, restarts, or component changes

Teams in regulated or safety-critical environments where behavior must be explainable and replayable


LTP is not optimized for quick prototyping or ad-hoc experimentation.
It is intended for systems that must remain interpretable over time.


---

## The Problem LTP Solves

Most AI systems fail not because they predict poorly,
but because they lose orientation over time.

This usually becomes visible after retries, restarts, reconnects, or model changes —
when behavior suddenly stops making sense, even though individual components still function.

LTP provides a continuity layer that preserves coherent behavior across time by making orientation explicit, inspectable, and reproducible.


---

## What Using LTP Looks Like

Using LTP does not change how models generate outputs.
It changes how systems reason about transitions between states.

Instead of treating each inference as an isolated event, LTP records:

the current orientation

admissible future branches

constraints under which transitions remain valid

drift accumulated over time


The result is not “better answers”, but traceable trajectories.
These transitions can be replayed and compared across versions.


---

## Getting Started (15 Minutes)

This path is intentionally minimal and non-opinionated.

1. Install the SDK


2. Run the canonical demo


3. Inspect the resulting orientation trace


4. Verify conformance against the protocol



Example (JavaScript):

```
pnpm install
pnpm demo:canonical-v0.1
pnpm -w ltp:inspect -- trace --input ./artifacts/trace.jsonl
pnpm ltp verify
```

This process does not require running or configuring a model.
It inspects continuity behavior independently of inference.


---

## What to Expect Next

After completing the canonical demo, the following parts of the repository should become easier to interpret:

protocol frames and schemas

conformance tests and verification logic

governance and RFC process


At this stage, LTP should feel less like a framework and more like a protocol surface.


---

## What LTP Is Not

For clarity, LTP is intentionally not:

a decision-making system

a model, agent, or inference engine

a memory store or vector database

an orchestration or task-management framework


LTP does not choose actions.
It maintains orientation so actions remain coherent over time.


---

## Final Note

LTP is designed to be adopted slowly and deliberately.

If your system already works well without explicit continuity guarantees,
you may not need it.

If your system fails in subtle ways when time, retries, or changes accumulate,
LTP exists to make those failures observable.


---

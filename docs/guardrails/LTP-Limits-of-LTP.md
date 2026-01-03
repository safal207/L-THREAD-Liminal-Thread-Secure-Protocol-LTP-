# Limits and Non-Goals of LTP

## Core Principle

LTP is a protocol, not a platform. This document prevents misclassification of LTP as an agent, policy engine, or decision system. By codifying what LTP does **not** do, we reduce scope creep, prevent category errors, and protect the protocol’s invariants.

## What LTP Is Not

### Not decision-making

LTP never selects an action, outcome, or “best” future. It only defines:

- admissible trajectories
- orientation constraints
- continuity across transitions

If you need a system to choose — you are operating above LTP.

### Not inference

LTP does not:

- generate tokens
- rank model outputs
- evaluate semantic correctness

All inference happens outside the protocol.

> Errors are allowed. Loss of orientation is not.

### Not memory

LTP does not store:

- embeddings
- knowledge graphs
- long-term semantic memory

It stores orientation state, not content. Using LTP as a memory layer breaks determinism and replayability.

### Not orchestration

LTP does not:

- route network traffic
- balance workloads
- manage distributed execution

It operates at the orientation layer, not the execution layer.

### Not optimization

LTP does not embed optimization or policy objectives into protocol semantics. It only ensures that whatever external rules exist are applied consistently over time.

## Anti-Patterns

If your implementation does any of the following, it is no longer LTP-compliant:

- ❌ Selecting or ranking actions inside LTP frames or orientation state.
- ❌ Treating orientation primitives as model attention, prompt-weaving, or retrieval logic.
- ❌ Persisting embeddings, knowledge graphs, or long-term content inside LTP state.
- ❌ Embedding business rules, policy decisions, or optimization logic into protocol semantics.

If your design requires any of the above, LTP is the wrong abstraction.

## Rule of Thumb

These limits protect LTP invariants:

- orientation continuity
- deterministic replay
- model-agnostic neutrality

Innovation lives above the protocol, not inside it. LTP defines where you are — not what you should do.

# LTP Consciousness Web and Orientation Shell

## Purpose
The Consciousness Web extends the Thread Life Model with an explicit graph view of threads and a lightweight orientation layer. It provides a clear picture of how threads relate, which ones hold attention, and how focus can be rotated without changing the underlying protocol or transport semantics.

## Core Concepts
- **Consciousness Web**: a graph built from a `ThreadMap`. Nodes are `ThreadVector` entries; links encode relationships between threads.
- **Links**: semantic edges between threads.
  - **parent-child** when `parentThreadId` is set and present in the map.
  - **shared-scope** when two threads share the same `ThreadScope` (individual, family, project, system).
  - **shared-tag** when threads share at least one tag (e.g., `liminal-os`).
- **Metrics**: per-thread scores with degree and a simple centrality score composed from degree, energyLevel, and resonanceLevel.
- **Orientation Shell**: a small set of sectors (like the panels of a turtle shell). Each sector is a filter by scope and/or tags. Rotating the shell = switching the active sectors.

## Goals
- Reveal which threads are central, weakening, or dominant via link degree and centrality scores.
- Group and navigate threads by scope or shared tags.
- Offer deterministic focus transforms: activate sectors to highlight threads; others become dormant.
- Keep the logic pure and composable so higher layers (e.g., L-EDGE) can consume the web without altering LTP core semantics.

## Interaction with LTP
- LTP still handles transport, security, and session mechanics.
- The Consciousness Web is metadata: it can be attached to sessions, inspected, or logged.
- Orientation Shell operations do not mutate threads; they provide filtered views over the web.

## Future Work
- Thread merge/transmission can reuse link weights to shape how energy/resonance propagate.
- Additional sectors (e.g., risk, opportunity) can extend the shell without changing the web model.

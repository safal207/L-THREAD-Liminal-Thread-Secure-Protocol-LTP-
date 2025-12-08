# LTP Thread Life Model

## Purpose
The Thread Life Model adds a semantic layer on top of LTP transport and security. It treats each thread as a life-vector that can be born, evolve, weaken, switch direction, and eventually be archived. This metadata can be attached to sessions, logged, or inspected by higher-level systems such as LIMINAL OS without changing core protocol semantics.

## Core Concepts
- **ThreadPhase**: `birth` → `active` → `weakening` → `switching` → `archived`.
- **ThreadScope**: `individual`, `family`, `project`, `system`.
- **ThreadVector**: typed record containing identifiers, timestamps, current phase, `energyLevel` (0..1), `resonanceLevel` (0..1), optional tags, and `externalRef` for mapping to other systems (e.g., L-EDGE or OS layers).
- **ThreadMap**: a pure container linking an `ownerId` (person or system) to a list of `ThreadVector` entries.

## Rules and Transitions
- **ThreadBirth**: threads start in `birth` with intent and initial energy/resonance. First meaningful events (`goal-updated`, `new-opportunity`) move them to `active`.
- **ThreadWeakening**: sustained drops in attention (`drop-in-attention`) or low energy (`<0.3`) move threads from `active` to `weakening`.
- **ThreadSwitch**: while weakening, a new context that resonates more (`new-opportunity` or `family-resonance`) can shift the phase to `switching`.
- **ThreadRe-Activation**: confirmed direction (`goal-updated`, `success`) returns a switching thread to `active`.
- **ThreadArchive**: explicit `shutdown-request` or very low energy (`<0.1`) moves any phase to `archived` for safe storage.
- **ThreadMerge / Transmission**: future extensions may merge or hand off `ThreadVector` instances; the current model keeps transitions deterministic and per-thread.

## Interaction with LTP
- LTP continues to handle transport, encryption, and routing.
- Thread Life Model supplies semantic metadata describing intent, scope, and lifecycle.
- Clients can attach `ThreadVector` snapshots to sessions, emit events that trigger transitions, and use `ThreadMap` to visualize personal, family, project, or system-level trajectories.

## Event Mapping
Events map to transitions through a pure state machine (`computeNextPhase`) that inspects the current phase, `energyLevel`, `resonanceLevel`, and the incoming event type. Helpers keep updates immutable and clamp numeric values to the `[0,1]` range to avoid undefined states.

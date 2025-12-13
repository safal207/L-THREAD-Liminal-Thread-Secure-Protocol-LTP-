# Liminal Thread Protocol (LTP) Whitepaper v0.1

## Abstract
The Liminal Thread Protocol (LTP) v0.1 defines minimal, self-describing frames that let agents, nodes, HUDs, and gateways coordinate orientation and routing without coupling to a single transport, storage layer, or language runtime. It stabilizes interoperability through deterministic canonical flows and conformance rules so that JS SDKs, Rust nodes, and HUDs agree on semantics, ordering, and failure behavior. LTP privileges explainability and graceful degradation: silence is treated as a signal, duplicate frames are ignored, and routing branches remain traceable. The goal is a repeatable substrate for meaning-making across AI-driven systems without inventing new frame types beyond v0.1. This document summarizes the problem space, the LTP approach, and how to adopt it incrementally while preserving ecosystem safety.

## Problem
Modern AI systems fracture across transports, languages, and storage choices. Without shared protocol primitives:
- **Interoperability collapses:** SDKs, nodes, and HUDs diverge in message shape and ordering, making multi-language parity fragile.
- **Continuity breaks:** reconnects, retries, and duplicate sends produce different outcomes, eroding user trust.
- **Explainability weakens:** opaque routing decisions and missing orientation signals prevent post-hoc analysis and governance.
- **Determinism drifts:** idempotency and ordering vary by stack, undermining reproducibility and self-tests.

## What LTP Is
LTP defines **frames as minimal self-describing units** (`hello`, `heartbeat`, `orientation`, `route_request`, `route_response`, `focus_snapshot`) with a frozen v0.1 contract. Frames are additive over time but must not break prior shapes. **Canonical Flow** prescribes deterministic sequencing so that Rust, Node, and JS SDKs emit equivalent branches for the same inputs. **Conformance** codifies the minimal requirements to protect ecosystem parity across transports and storage choices.

## Core Primitives
- **Frames:** Minimal envelopes carrying typed payloads. Each frame declares version, id, timestamp, and type while keeping payload semantics scoped per type.
- **Canonical Flow:** A deterministic reference sequence (hello → heartbeat → orientation → route_request → route_response → optional focus_snapshot) ensuring cross-language reproducibility and explainable routing.
- **Conformance:** A testable checklist for nodes, clients, agents, and HUDs to validate frame support, ordering, determinism, and graceful handling of silence or unknown frames.

## Design Principles
- **Deterministic:** Same inputs yield the same branch ordering and payload fields across implementations.
- **Explainable routing:** Route responses present multiple branches with confidences; decisions remain traceable to inputs and constraints.
- **Graceful degradation:** Under load, systems may reduce depth/branching but must avoid crashes and preserve ordering.
- **Silence as a signal:** Absence of frames is meaningful; no forced responses when data is missing.
- **Transport-/storage-/language-agnostic:** Works over WebSocket or REST, with or without persistence, across JS and Rust stacks.

## Reference Implementations
- **JS SDK:** Emits and parses v0.1 frames for clients and HUDs.
- **Rust node examples:** Demonstrate canonical routing, id uniqueness handling, and branch ordering.
- **HUD examples:** Consume `focus_snapshot` and `orientation` for visualization without diverging from canonical flow.

## Integration Paths
- **Start with presence:** Implement `hello` to declare roles and capabilities, then add `heartbeat` for liveness.
- **Add orientation:** Emit `orientation` once posture stabilizes to establish semantic position.
- **Enable routing:** Accept `route_request` and return `route_response` with ordered branches and confidences.
- **Instrument HUDs:** Optionally publish `focus_snapshot` for observability and self-diagnostics.
- **Incremental rollout:** Maintain v0.1 frame shapes; ignore unknown types while logging for future adoption.

## Security & Safety Notes
- **Replay resistance:** Treat `id` as unique per sender scope; ignore duplicate ids to prevent side effects on retries.
- **Ordering:** Preserve frame order per connection/session to avoid conflicting branches.
- **Silence and reconnects:** Allow silence without forced responses; on reconnects, replay last known `orientation` or `focus_snapshot` only when connection ids differ.
- **Minimal claims:** No deep cryptography guarantees; rely on deterministic flows and explicit ids for safety boundaries.

## Roadmap
- **v0.1 (current):** Frozen frame shapes, canonical flow reference, conformance checklist, transport/storage/language agnosticism.
- **v0.2 (planned):** Deeper conformance tests, reference registries for capabilities, expanded tooling for determinism auditing, stronger self-test reporting—without introducing new frame types that break v0.1 compatibility.

## Non-goals
- Prescribing ML/LLM models, persistence layers, or UX patterns.
- Replacing existing transports or databases.
- Offering probabilistic guarantees beyond deterministic sequencing and branch ordering.

## Appendix: How to Read the Specs
- Start with **`specs/LTP-Frames-v0.1.md`** to understand frame envelopes and payloads.
- Move to **`specs/LTP-Canonical-Flow-v0.1.md`** for the deterministic reference sequence and session semantics.
- Consult **`specs/LTP-Conformance-v0.1.md`** to validate required frame support, ordering, determinism, and non-goals.
- Refer to **`specs/LTP-Flow-v0.1.md`** and related docs for transport notes; treat all as transport-/storage-/language-agnostic guidance.

# LTP v0.1 — Orientation Protocol One-Pager

**Tagline:** The transport-agnostic protocol for deterministic orientation, routing, and explainable futures across AI systems.

## Problem
AI stacks are fragmented: each runtime invents its own message shapes, causing brittle routing, duplicated logic, and unpredictable retries. Orientation signals are missing or opaque, so teams cannot replay or audit decisions.

## Solution — LTP
Minimal self-describing **frames** (`hello`, `heartbeat`, `orientation`, `route_request`, `route_response`, `focus_snapshot`) plus a **Canonical Flow** and **Conformance** rules that keep JS SDKs, Rust nodes, and HUDs in parity across transports and storage choices.

## What Exists Today (Pain)
- Divergent envelopes per SDK/API; no shared deterministic flow.
- Reconnects and retries shift outcomes because ids and ordering are inconsistent.
- HUDs need bespoke adapters for every stack.

## How It Works
- **Frames:** Stable v0.1 envelopes with explicit ids, timestamps, and payload semantics.
- **Canonical Flow:** hello → heartbeat → orientation → route_request → route_response → optional focus_snapshot; deterministic sequencing and branch ordering.
- **Conformance:** Testable requirements for frame support, ordering, silence-as-signal handling, and explainable routing.

## Why It’s Defensible
- **Standards-grade:** Frozen frame shapes and normative flow enable reproducible audits.
- **Ecosystem-first:** Works across transports (WS/REST) and languages (JS/Rust) without storage lock-in.
- **Explainable by design:** Multiple route branches with confidences keep futures inspectable and replayable.

## Next Milestones
- Conformance kit expansion with deeper branch-order tests.
- Capability registry for orientation/routing declarations.
- Tooling for determinism audits and self-test publication.

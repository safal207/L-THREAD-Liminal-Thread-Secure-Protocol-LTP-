# LTP Core vs Extensions

## Status of This Document

This document is **normative** with respect to LTP Frozen Core boundaries. It defines what extensions **MAY** do, and what **MUST** remain invariant.

This note clarifies which parts of LTP are Frozen Core and which are optional extensions. LTP Core is intentionally small. If you are unsure whether a feature belongs to Core — it does not.

## Core vs Extensions

| Aspect | Frozen Core | Extensions |
| --- | --- | --- |
| Orientation schema | MUST remain unchanged | MUST reference core schema |
| Transition rules | MUST be deterministic | MAY add interpretation |
| Scoring / weighting | FORBIDDEN | ALLOWED |
| Implicit updates | FORBIDDEN | FORBIDDEN |
| Strategy logic | N/A | ALLOWED |

## LTP Core (Frozen v0.1)
- **Frame surface:** `hello`, `heartbeat`, `orientation`, `route_request`, `route_response`, `focus_snapshot`.
- **Determinism:** Canonical flow and guardrails must remain stable for interop and explainability.
- **Conformance:** Fixtures and CI badge validate v0.1 behavior across SDKs and nodes.
- **Compatibility:** Backward-compatible changes only; extensions cannot mutate v0.1 frames or semantics.

## LTP Extensions (Non-core)
- **HUD / visualization layers** for inspecting orientations, branches, and focus snapshots.
- **Agent and automation helpers** that sit above the protocol surface.
- **LIMINAL-specific experiences** (Liminal Web, Consciousness Web, Orientation Shell) that are not required for core adoption.
- **Experimental flows and telemetry** that provide richer context but do not change the frozen frames.

## Forbidden Extension Patterns

The following patterns are explicitly disallowed:

- Modifying core orientation fields.
- Introducing hidden state that affects transitions.
- Implicit correction of drift or focus.
- Learning-based mutation of orientation without traceable transitions.

## Golden Invariant

If an extension cannot be removed without changing the recorded orientation trajectory, it violates the Frozen Core contract.

## Mental Model

Think of the Frozen Core as a ledger. Extensions are views, interpreters, or tools — never writers of the ledger itself.

## Explicit Non-Goals
- Core does not prescribe UX, product flows, or recommendation logic.
- Extensions must not redefine v0.1 frame schemas or canonical routing order.
- No proprietary lock-in: implementations should stay interoperable via the conformance kit.

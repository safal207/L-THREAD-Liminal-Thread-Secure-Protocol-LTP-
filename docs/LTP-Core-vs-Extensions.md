# LTP Core vs Extensions

## Status of This Document

This document is **normative** with respect to LTP Frozen Core boundaries. It clarifies which parts of LTP are Frozen Core and which are optional extensions. LTP Core is intentionally small. If you are unsure whether a feature belongs to Core — it does not.

## Core vs Extensions

| Aspect | Frozen Core | Extensions |
| --- | --- | --- |
| Orientation schema | MUST NOT change v0.1 frame fields | MUST reference core schema |
| Transition rules | MUST be deterministic | MAY add interpretation without altering core transitions |
| Scoring / weighting | MUST NOT define normative scoring semantics | MAY compute scores without mutating recorded trajectory |
| Implicit updates | MUST NOT apply | MUST NOT apply |
| Strategy logic | Not specified by Core | MAY add strategies |

## LTP Core (Frozen v0.1)
- **Frame surface:** `hello`, `heartbeat`, `orientation`, `route_request`, `route_response`, `focus_snapshot`.
- **Canonical schemas:** Defined in `specs/LTP-Frames-v0.1.md` and serialized in fixtures under `specs/vectors/*.v0.1.json`.
- **Determinism:** Canonical flow and guardrails must remain stable for interop and explainability.
- **Canonical transition order:** `specs/LTP-Canonical-Flow-v0.1.md` and `specs/flow/golden-transcript.v0.1.jsonl` define the deterministic sequence and transition semantics.
- **Conformance:** Fixtures and CI badge validate v0.1 behavior across SDKs and nodes.
- **Versioning:** Frozen artifacts carry the `v0.1` tag; later protocol versions MUST be additive or explicitly versioned to avoid breaking v0.1.
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

### Examples

- ✅ Compliant: an inspector computes a drift metric from a trace and writes no new frames.
- ❌ Non-compliant: an extension auto-corrects orientation fields without emitting a transition.

## Golden Invariant

If removing an extension changes any recorded Core frame or transition, the extension violated the Frozen Core contract.

## Mental Model

Think of the Frozen Core as a ledger. Extensions are views, interpreters, observability, or UX layers — never writers of the ledger itself.

## Explicit Non-Goals
- Core does not prescribe UX, product flows, or recommendation logic.
- Extensions must not redefine v0.1 frame schemas or canonical routing order.
- No proprietary lock-in: implementations should stay interoperable via the conformance kit.

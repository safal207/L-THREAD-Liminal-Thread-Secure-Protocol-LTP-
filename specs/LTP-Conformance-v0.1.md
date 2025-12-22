# LTP Conformance v0.1 — Status: RC1 (additive-only)

_Status: RC1. Change policy: **additive-only** until v0.1 tag. Canonical flow reference: `specs/LTP-Canonical-Flow-v0.1.md`; frame surface: `specs/LTP-Frames-v0.1.md`. Release gate and smoke instructions live in `specs/LTP-v0.1-RC1.md`._

## Status

This document is **NORMATIVE** for LTP Frozen Core v0.1.

All statements using RFC 2119 keywords (MUST, MUST NOT, SHOULD, MAY)
define compliance requirements.

Examples and diagrams are **INFORMATIVE** unless explicitly stated otherwise.

## Purpose
Defines the minimal, testable requirements an implementation MUST satisfy to be considered LTP-conformant.

This document keeps the protocol stable across languages (JS / Rust / HUD / Agent) and transports by pinning a small, interoperable core.

## Scope
- Applies to Nodes, Clients, Agents, and HUDs.
- Transport-agnostic (WS / REST / others).
- Storage-agnostic (in-memory or persistent).

## Frozen Core scope
Frozen Core v0.1 defines:
- orientation primitives
- transition semantics
- continuity invariants

It does NOT define:
- routing strategies
- scoring algorithms
- UI, visualization, or SDK behavior

---

## Required Frame Support
Implementations MUST accept and emit the following frames:
- `hello`
- `heartbeat`
- `orientation`
- `route_request`
- `route_response`

Implementations MAY support:
- `focus_snapshot`
- Future extensions (MUST accept unknown fields in known frames and MUST ignore unknown frame types while keeping the connection/session alive; logging is allowed but not required).

---

## Flow Requirements
An implementation MUST:
- Accept a `hello` before any other frame on a connection/session or request chain.
- Tolerate missing optional frames without breaking the flow.
- Preserve frame ordering per connection/session.
- Treat silence as a signal (no forced responses for absence).
- Accept unknown fields in known frames without rejecting the frame.
- Ignore unknown frame types while keeping the connection/session alive (forward-compatible), MAY log.
- Validate protocol version `v: "0.1"` (or compatible); otherwise reject or ignore.
- Treat `id` as unique per sender scope to avoid duplicate side effects on retries.

## Continuity and orientation compliance
A compliant LTP implementation **MUST NOT** silently lose orientation state.
Silent orientation loss is considered a protocol violation, even if downstream behavior appears correct.

Orientation Loss:
A condition where identity, focus, or drift history is dropped, reset, or overwritten without an explicit transition event.

Explicit rules:
**Forbidden (MUST NOT):**
- Reset identity without an explicit `transition` frame.
- Rewrite past `drift_history` entries.
- Silently drop `focus_momentum` updates.

**Allowed (MAY/SHOULD):**
- Append `drift_history` entries only in `transition` frames.
- Degrade branch confidence with recorded reasons when supported by the payload schema (SHOULD document the reason).
- Mark discontinuity explicitly with a violation or error frame when discontinuity is detected.

---

## Canonical Flow Compliance
An implementation MUST:
- Reproduce Canonical Flow semantics defined in `specs/LTP-Canonical-Flow-v0.1.md`.
- Return multiple plausible branches when routing (no single forced output unless canonical flow says so).
- Degrade gracefully under load (reduced depth/branching is acceptable; crashes are not).

---

## Determinism & Explainability
- “Same input” means the same ordered sequence of frames (byte-stable for binary payloads or canonical JSON for structured payloads), the same protocol version, and the same node configuration (including constraint sets and policy flags).
- Same inputs SHOULD yield the same outputs within implementation tolerance for all deterministic fields that drive routing, orientation, and branch ordering.
- Timestamps, nonces, and transport-level identifiers MAY vary, but MUST NOT affect deterministic fields or reorder stable outputs.
- Routing decisions MUST be explainable (traceable factors, not opaque randomness).

---

## Allowed Extension

An **Allowed Extension** operates on LTP artifacts without redefining their semantics.

An extension MAY:
- read LTP traces, frames, or orientation snapshots
- visualize, index, or analyze protocol outputs
- attach external metadata without affecting replayability

An extension MUST NOT:
- mutate Focus Node semantics
- alter admissibility rules
- inject heuristic or learned scores into protocol state

Allowed extensions may claim compatibility only if they preserve full determinism and replayability.

---

## Derived System

A **Derived System** builds on LTP concepts or data, but reinterprets or enriches their semantics.

A derived system MAY:
- apply additional scoring, learning, or heuristics
- reinterpret orientation signals
- combine LTP data with proprietary logic

A derived system MUST NOT:
- claim LTP protocol compliance
- use LTP naming for modified semantics
- represent itself as a conforming implementation

Derived systems are valid, but exist outside the LTP protocol boundary.

---

## Compatibility Invariant

If a system alters any of the following properties, it is no longer LTP-compliant:

- deterministic replay of orientation
- admissibility semantics of future branches
- identity continuity across transitions
- protocol-defined focus evolution

Compliance is binary. There is no partial or “mostly” LTP compliance.

---

## Example

A visualization tool that reads orientation traces and renders future branches is an Allowed Extension.

A system that injects learned confidence scores directly into the Focus Node is a Derived System and MUST NOT claim LTP compliance.

---

## Non-Goals
- No requirement for ML or LLM usage.
- No requirement for persistence or global state.
- No mandate for a specific UX/HUD.
- See also: [What LTP Is Not](./LTP-What-It-Is-Not.md) for detailed boundaries.

---

## Conformance Levels (Optional)
- **LTP-Core**: Required frame handling + Flow Requirements.
- **LTP-Flow**: LTP-Core + Canonical Flow Compliance.
- **LTP-Canonical**: LTP-Flow + Determinism & Explainability self-test coverage.

---

## Self-Test Declaration
Implementations SHOULD expose a self-test that demonstrates canonical flow compliance (inputs, branches, and expected outcomes) and publish the result as part of their release artifact or diagnostics endpoint.

## Compliance verification
Implementations SHOULD provide a reproducible trace of orientation transitions.

Reference conformance tests are provided in `/conformance`.
A compliant implementation SHOULD pass all Frozen Core v0.1 checks.

## Conformance report minimum contract
Automated conformance output MUST include:
- `protocol_version`
- `implementation_id`
- A pass/fail summary
- An artifact link or trace reference (file path or URL)
- Failing invariant name and failing frame identifier when a check fails

---

## Declaration Phrase
An implementation MAY claim: **"This implementation is LTP-conformant (v0.1)."**

---

LTP defines protocol invariants. Everything else is implementation choice.

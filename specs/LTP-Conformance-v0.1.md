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
- Future extensions (MAY be ignored if unknown).

---

## Flow Requirements
An implementation MUST:
- Accept a `hello` before any other frame on a connection/session or request chain.
- Tolerate missing optional frames without breaking the flow.
- Preserve frame ordering per connection/session.
- Treat silence as a signal (no forced responses for absence).
- Ignore unknown frame types (forward-compatible), MAY log.
- Validate protocol version `v: "0.1"` (or compatible); otherwise reject or ignore.
- Treat `id` as unique per sender scope to avoid duplicate side effects on retries.

## Continuity and orientation compliance
A compliant LTP implementation **MUST NOT** silently lose orientation state.
Silent orientation loss is considered a protocol violation, even if downstream behavior appears correct.

Orientation Loss:
A condition where identity, focus, or drift history is dropped, reset, or overwritten without an explicit transition event.

---

## Canonical Flow Compliance
An implementation MUST:
- Reproduce Canonical Flow semantics defined in `specs/LTP-Canonical-Flow-v0.1.md`.
- Return multiple plausible branches when routing (no single forced output unless canonical flow says so).
- Degrade gracefully under load (reduced depth/branching is acceptable; crashes are not).

---

## Determinism & Explainability
- Same inputs SHOULD yield the same outputs within implementation tolerance.
- Routing decisions MUST be explainable (traceable factors, not opaque randomness).

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

---

## Declaration Phrase
An implementation MAY claim: **"This implementation is LTP-conformant (v0.1)."**

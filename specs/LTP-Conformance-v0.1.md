# LTP Conformance v0.1 (Draft)

## Purpose
Defines the minimal, testable requirements an implementation MUST satisfy to be considered LTP-conformant.

This document keeps the protocol stable across languages (JS / Rust / HUD / Agent) and transports by pinning a small, interoperable core.

## Scope
- Applies to Nodes, Clients, Agents, and HUDs.
- Transport-agnostic (WS / REST / others).
- Storage-agnostic (in-memory or persistent).

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
- Accept a `hello` before any other frame on a connection/session.
- Tolerate missing optional frames without breaking the flow.
- Preserve frame ordering per connection/session.
- Treat silence as a signal (no forced responses for absence).

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

---

## Conformance Levels (Optional)
- **LTP-Core**: Required frame handling + Flow Requirements.
- **LTP-Flow**: LTP-Core + Canonical Flow Compliance.
- **LTP-Canonical**: LTP-Flow + Determinism & Explainability self-test coverage.

---

## Self-Test Declaration
Implementations SHOULD expose a self-test that demonstrates canonical flow compliance (inputs, branches, and expected outcomes) and publish the result as part of their release artifact or diagnostics endpoint.

---

## Declaration Phrase
An implementation MAY claim: **"This implementation is LTP-conformant (v0.1)."**

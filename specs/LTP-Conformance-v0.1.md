# LTP Conformance Spec v0.1 (Draft)

## Goal
Define a minimal conformance surface for LTP implementations.

## Required capabilities

### C1 — Orientation snapshot format
Implementation MUST support a serialized orientation snapshot sufficient for replay.

### C2 — Transition validation
Implementation MUST validate transitions for admissibility against constraints.

### C3 — Trace emission
Implementation MUST emit a trace of:
- snapshots (or snapshot references)
- transitions
- validation outcomes (admitted / rejected)
- drift indicators (if implemented)

### C4 — Replay
Given a trace, implementation MUST be able to replay orientation state evolution deterministically.

### C5 — Local failure semantics
Invalid transitions MUST not corrupt the current orientation.
Rejection MUST be explicit and traceable.

## Non-requirements (v0.1)
- No requirement to run inference
- No requirement to store long-term memory content
- No requirement to orchestrate tasks/services
- No requirement to optimize cost/latency

## Pass/Fail criteria
An implementation is conformant if it:
1) preserves invariants (see `docs/invariants.md`)
2) passes the provided conformance tests (when available)
3) can replay traces with deterministic results

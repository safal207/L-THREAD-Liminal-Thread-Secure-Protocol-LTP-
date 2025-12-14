# RFC Process (v0.1)

LTP changes are formalized as RFCs that document intent, compatibility, and operational impact. The process is designed to keep Frames, Flow, and Conformance aligned while remaining lightweight for contributors.

## RFC Types
- **RFC-Core:** Reserved for minimal core adjustments (frame surface, core invariants). Triggered rarely with broad interoperability evidence.
- **RFC-Flow:** Evolves routing semantics, timelines, and branching behavior without altering frozen frame types.
- **RFC-Frame:** Adds optional frames or payload fields that remain backward-compatible with v0.1 conformance expectations.
- **RFC-Governance:** Adjusts governance, neutrality, or decision processes.
- **RFC-Extension:** Adds optional services, tooling, or profiles that do not alter the core protocol contract.

## Required Sections (MUST)
Every RFC MUST include:
- **Motivation:** The problem, user value, and why existing Frames/Flow cannot cover it.
- **Backward compatibility:** Expected behavior for v0.1 conformant implementations and upgrade paths.
- **Impact on conformance:** How fixtures, badges, and CI reports change; required additions to the conformance kit.
- **Failure modes:** Operational and safety considerations, including downgrade expectations.
- **Why this does NOT require ML/state/storage:** Explicitly reject solutions that mandate machine learning, durable storage, or hidden state to align with neutrality and explainability.

## Lifecycle
1. **Draft:** Open PR with RFC markdown under `rfcs/` or `governance/` and link to related specs (Frames, Flow, Conformance).
2. **Discussion:** Rough consensus on issues and forums; Advisory Board may issue non-binding notes.
3. **Last Call:** Timeboxed review (minimum 14 days for RFC-Core/Governance; 7 days for others).
4. **Accepted / Rejected:** Documented decision with dissent notes and references to conformance updates.
5. **Implemented:** Merged specs, fixtures, and SDK changes; conformance kit updated.
6. **Historical:** Archived with version tags; remains discoverable for future compatibility.

## Decision Signals
- Rough consensus and documented dissent drive outcomes; silence is treated as a signal but not as approval.
- Maintain a change log per RFC with implementation references and test artifacts.

## Conformance Integration
- Accepted RFCs MUST ship updated fixtures and reports aligned with [`specs/LTP-Conformance-Report-v0.1.md`](../specs/LTP-Conformance-Report-v0.1.md).
- New capabilities SHOULD be guarded by explicit versioning per [`governance/LTP-Versioning.md`](./LTP-Versioning.md).

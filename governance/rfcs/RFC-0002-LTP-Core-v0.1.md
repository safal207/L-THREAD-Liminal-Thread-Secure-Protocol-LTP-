# RFC-0002: LTP Core v0.1

- **RFC ID:** 0002
- **Status:** Draft
- **Owner:** @-
- **Reviewers:** @-
- **Related ADR(s):** -

## Summary
This RFC freezes the core functionality of LTP v0.1 to provide a stable, non-breaking foundation for the ecosystem. By defining a minimal set of mandatory frame types and clear compatibility rules, we enable SDKs, nodes, and enterprise services to build on a reliable protocol version, eliminating the risk of unexpected breaking changes.

## Problem Statement
The absence of a formally frozen protocol core creates significant risk for all participants in the LTP ecosystem. SDK developers cannot guarantee compatibility, node operators face unpredictable updates, and enterprise clients cannot sign contracts based on a volatile standard. To move from a "project" to a "protocol," we must establish a stable, reliable foundation.

## Scope (LTP Core v0.1)
The following components constitute the frozen core of LTP v0.1.

### Mandatory Frame Types
All v0.1-compliant implementations MUST support the following frame types:
- `hello`
- `heartbeat`
- `orientation`
- `route_request`
- `route_response`

### Optional / Extension Frame Types
Implementations MAY support additional frame types. The following are officially recognized as part of the v0.1 ecosystem but are not mandatory for core compliance:
- `focus_snapshot`
- Future frames (must be additive)

## Compatibility Rules
1.  **No Breaking Changes:** The structure and semantics of the Core v0.1 frame types are immutable. No fields may be removed or altered in a backward-incompatible way.
2.  **Additive Changes Only:** New frame types and new optional fields within existing frames are permitted, but they must not interfere with the processing of core frames by older clients.
3.  **Graceful Handling of Unknown Frames:** A compliant implementation MUST ignore unknown frame types, but it is recommended to log them for debugging purposes.

## Security & Integrity
- **ID Uniqueness:** The `id` field of each frame MUST be unique within the scope of the sender for a given session.
- **Replay/Duplicate Protection:** While full replay attack mitigation is a broader concern, v0.1 implementations are expected to handle duplicate frame IDs within a reasonable time window gracefully (e.g., ignore them).
- **Strict Versioning:** The protocol version field `v` MUST be strictly validated to be `"0.1"`.

## Acceptance Criteria
- A `conformance-kit` will be developed to verify that an implementation adheres to the Core v0.1 specification.
- The canonical JS and Rust SDKs must pass the `conformance-kit` tests.

## Rollout Plan
1.  **Adoption:** This RFC is adopted and its status is changed to "Accepted".
2.  **Implementation:** Conformance kit and SDK updates are implemented.
3.  **Verification:** All core ecosystem components are verified against the new conformance kit.

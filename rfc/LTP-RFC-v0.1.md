# LTP RFC v0.1 (Skeleton)

## Status
- Stage: Draft skeleton for consolidation
- Scope: Tighten v0.1 language without introducing new primitives

## Goals
- Reduce interoperability risk by clarifying MUST vs SHOULD
- Keep drift informational in v0.1
- Make Future Branch confidence optional and bounded
- Forbid continuity token rotation within a session

## Terminology
- **Orientation** — semantic state announced by the focus node
- **Future Branch** — `{id, class(primary|recover|explore), path, confidence?}`
- **Continuity Token** — stable session identifier carried after `hello`
- **Drift** — informational divergence metric attached to `focus_snapshot`

## Protocol Guardrails (v0.1)
- Continuity tokens MUST remain stable within a session; rotation is allowed only at explicit session boundaries.
- Future Branch confidence values are OPTIONAL; if present, they MUST be within `[0.0, 1.0]`. Normalization across branches is tooling-only.
- Drift is informational; no monotonicity or replay invariant is required in v0.1.
- Frames: `hello`, `heartbeat`, `orientation`, `route_request`, `route_response`, `focus_snapshot` (frozen surface).

## Tooling Notes
- Tooling MAY normalize branch confidences for visualization, but this is not required by the protocol.
- Drift visualization SHOULD indicate when values increase, but protocol compliance is not affected.
- Replay/inspection tools SHOULD surface continuity token changes as warnings.

## Conformance Pointers
- Use existing conformance fixtures to validate frame ordering and continuity handling.
- Future Branch confidence checks SHOULD warn (not fail) when values are missing; they MUST fail when values are outside `[0.0, 1.0]`.


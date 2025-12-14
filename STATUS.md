# LTP Status

- **Version:** v0.1 Draft
- **Protocol maturity:** Canonical flow and frame definitions are frozen for v0.1; SDKs and demos are kept in lockstep via conformance fixtures.

## Stable surfaces (v0.1)
- Frame types: `hello`, `heartbeat`, `orientation`, `route_request`, `route_response`, `focus_snapshot`.
- Canonical flow ordering for routing and reconnect paths.
- Conformance fixtures under `fixtures/conformance/v0.1` and the badge/JSON outputs produced by `verify:dir`.
- Determinism expectations: `version = 0.1` and `determinismHash` values published in CI artifacts.

## Experimental surfaces
- HUD visualizations and telemetry formats beyond the canonical frame payloads.
- Additional metadata fields not listed in the v0.1 release slice.
- Preview routing semantics noted in the v0.2 roadmap (not part of the frozen contract).

## Backward compatibility policy
- v0.1 is frozen: no breaking changes to frame names, required fields, or canonical ordering.
- New features land as additive/optional fields or as separate experimental tracks until a new minor version is declared.
- Conformance tests remain the source of truth; any change requires updated fixtures and a version bump.

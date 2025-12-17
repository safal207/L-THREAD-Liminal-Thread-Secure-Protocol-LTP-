# LTP Core vs Extensions

This note clarifies which parts of LTP are frozen core and which are optional extensions.

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

## Explicit Non-Goals
- Core does not prescribe UX, product flows, or recommendation logic.
- Extensions must not redefine v0.1 frame schemas or canonical routing order.
- No proprietary lock-in: implementations should stay interoperable via the conformance kit.

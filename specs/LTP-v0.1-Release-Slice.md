# LTP v0.1 Release Slice

A one-page release slice for the frozen v0.1 surface. Use it as a contract for demos, badges, and partner onboarding.

## Frozen in v0.1

- Frame surface: `hello`, `heartbeat`, `orientation`, `route_request`, `route_response`, `focus_snapshot`.
- Canonical flow: `hello → heartbeat → orientation → route_request → route_response` with deterministic ordering and IDs.
- Normalized routing branches: accepts map/array, normalized to `primary`, `recover`, `explore`.
- Conformance kit: deterministic verify + badge JSON (`reports/badge.json`), report at `reports/ci-report.json`.
- Canonical demo: `pnpm -w demo:canonical-v0.1` (or `make demo`) prints the frozen flow and routing summary.

## Experimental / fast-moving

- Explainability factors and confidence deltas in demos (format may change).
- HUD/monitor visualization themes and gateway relays.
- Alternate transports beyond the reference WebSocket + CLI harnesses.
- Roadmap features tagged v0.2+ (additional routing semantics, richer focus tags).

## Compatibility promise

- No breaking changes to the v0.1 frame names, required fields, or ordering.
- Badge/report format is stable for v0.1 (`reports/badge.json`, `reports/ci-report.json`).
- Fixtures under `fixtures/conformance/v0.1/` are treated as the canonical acceptance set.
- Canonical demo output remains deterministic for onboarding and screenshots.

## How to ship v0.1

1. Install dependencies: `pnpm -w install` (fallback: `npm install`).
2. Run the canonical demo: `pnpm -w demo:canonical-v0.1` or `make demo`.
3. Verify conformance: `pnpm -w ltp:conformance verify:dir fixtures/conformance/v0.1 --out reports/ci-report.json`.
4. Publish artifacts: upload `reports/ci-report.json` + `reports/badge.json` from CI.

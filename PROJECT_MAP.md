# Project Map: LTP + Liminal OS Unified View

## 1. One-liner
A secure, deterministic protocol stack (LTP) with specs, reference SDKs/nodes, and demos proving orientable routing for Liminal OS.

## 2. North Star
- Building: a stable frame/flow protocol with deterministic routing and focus/orientation semantics that different runtimes can reproduce.
- Building: reference SDKs (JS) and nodes (Rust) that uphold the canonical flow and expose explainable routing for clients and HUDs.
- Not building: heavy backend services, persistent databases, or ML inference inside the protocol layer; those stay outside LTP.

## 3. Current architecture
```
specs/
  LTP-Frames-v0.1.md (frame shapes)
  LTP-Flow-v0.1.md (Flow v0.1 semantics)
  LTP-Canonical-Flow-v0.1.md (Canonical Flow v0.1 deterministic sequence)
  flow/ (supporting drafts)
sdk/js/
  src/ (routing, orientation, time, frames)
  tests/ (orientation/thread life/clients)
nodes/ltp-rust-node/
  src/ (main.rs, protocol.rs, tests.rs)
src/
  server/ (httpDemoServer.ts, wsDemoServer.ts)
  demos/ (explainRoutingDemo.ts, story demos)
  routing/ (focus/orientation previews)
  turtle/ and visualization/ (experimental focus/turtle views)
examples/
  canonical-flow.ts, turtle-hud/
scripts/
  monitor/, gateway/, demo/ (HUD + relay + scenario tools)
```

## 4. LTP Core (Frozen for v0.1)
- `specs/LTP-Frames-v0.1.md`: authoritative frame contracts (frozen; only clarifications/bugfixes until v0.2).
- `specs/LTP-Flow-v0.1.md`: Flow v0.1 motion/ordering rules for frames across time (frozen for v0.1).
- `specs/LTP-Canonical-Flow-v0.1.md`: Canonical Flow v0.1 deterministic hello→heartbeat→orientation→routing reference sequence for conformance (includes the Conformance v0.1 checklist).
- `specs/LTP-Spec-v0.1.md`: consolidated spec entry point tying frames and flow together.
- `specs/LTP-v0.1-Release.md`: official public release definition.
- Frozen means no shape changes or new required fields until v0.2; compatibility and determinism have priority.

## 5. Reference implementations
- JS SDK (`sdk/js/src`): proves deterministic routing, focus/orientation math, and frame helpers. Tests live in `sdk/js/tests` (e.g., `orientation/`, `threadLifeModel.test.js`); run with `cd sdk/js && npm test`.
- Rust node (`nodes/ltp-rust-node/src/main.rs`): proves multi-language interop and canonical flow replay; run with `cd nodes/ltp-rust-node && cargo run -p ltp-rust-node` (default WS on 127.0.0.1:7070).

## 6. Client / HUD demos
- REST routing explainability: `src/server/httpDemoServer.ts` (`npm run demo-server`) shows request→orientation→routing→explanation.
- WebSocket orientation/routing stream: `src/server/wsDemoServer.ts` (`npm run ws-demo-server`) streams hello/heartbeat/orientation/route_suggestion frames.
- HUD / focus monitor: `scripts/monitor/ltp-focus-hud.ts` (`npm run ltp:monitor`) renders live focus/mode metrics; `scripts/gateway/ltp-node-gateway.ts` offers a relay view.
- Canonical flow walkthrough: `examples/canonical-flow.ts` (`npm run demo:canonical`) replays the normative flow; `examples/turtle-hud/` holds the HUD-style visualization assets.

## 7. Roadmap
- v0.1: stabilize specs (Frames/Flow/Canonical), self-test JS SDK + Rust node against canonical flow.
- v0.2: add routing modes, conformance harness, and an interop matrix across runtimes.
- v0.3: higher-order turtle/spider orientation and richer HUD narratives (explicitly later).

## 8. Rules of evolution (anti-chaos)
- No breaking changes to frames; additive/compatible only.
- Unknown frames must be ignored (forward-compat tolerant).
- Silence is a signal; heartbeat/orientation cadence is part of semantics.
- Determinism + explainability over randomness; routing choices must be reproducible.
- Demos are part of the protocol proof; keep them aligned with specs.

## 9. Quickstart
Fast path CI check: `pnpm -w ltp:verify` (runs canonical flow + conformance fixtures; exits 0 on OK/WARN, 2 on FAIL).

1) Install deps: `npm install` (root) and `cd sdk/js && npm install` for SDK workspace.
2) Validate types/tests: `npm test` (root) or `npm run test:verify-types` for schema checks.
3) Run canonical Rust node: `cd nodes/ltp-rust-node && LTP_NODE_ADDR=127.0.0.1:7070 cargo run -p ltp-rust-node`.
4) Start REST demo server: `npm run demo-server` then call `http://localhost:4000/demo/explain-routing`.
5) Stream WS routing demo: `npm run ws-demo-server` and connect to `ws://localhost:4001/ws/orientation-demo`.
6) Observe HUD metrics: `npm run ltp:monitor` to watch focus/mode snapshots.

## 10. Golden path in 60 seconds
```bash
npm install
npm run demo:canonical
```
Expected output (condensed):
- Terminal log starts with `hello`/`heartbeat` frames, followed by an `orientation` snapshot.
- A `route_request` is issued and a deterministic `route_response` is printed with ordered `branches[]`.
- Optional `focus_snapshot` metrics appear, confirming the Canonical Flow v0.1 path end-to-end.

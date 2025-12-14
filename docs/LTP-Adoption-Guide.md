# LTP Adoption Guide (30-Minute Evaluation)

This guide lets a CTO or architect evaluate LTP in 30 minutes: read the minimum, run a deterministic path, verify outputs, and decide whether LTP fits your stack.

## 1) Read (10 minutes)
- **Protocol surface (frozen):** [`specs/LTP-Canonical-Flow-v0.1.md`](../specs/LTP-Canonical-Flow-v0.1.md) and [`specs/LTP-v0.1-Release-Slice.md`](../specs/LTP-v0.1-Release-Slice.md) — frame types, canonical order, and guardrails.
- **Conformance expectations:** [`fixtures/conformance/v0.1`](../fixtures/conformance/v0.1) — expected-pass/expected-fail cases.
- **Reference implementation overview:** [`ARCHITECTURE.md`](../ARCHITECTURE.md) — how SDKs, nodes, and HUDs compose.

## 2) Run (10 minutes)
- Install dependencies once: `pnpm -w install` (or `npm install`).
- Run the frozen canonical demo: `pnpm -w demo:canonical-v0.1` (or `make demo`).
- Optional: run the Rust node for WS testing: `cd nodes/ltp-rust-node && LTP_NODE_ADDR=127.0.0.1:7070 cargo run -p ltp-rust-node`.

## 3) Verify (5 minutes)
- Conformance smoke: `pnpm -w ltp:conformance verify fixtures/conformance/v0.1/ok_basic_flow.json`.
- Directory sweep: `pnpm -w ltp:conformance verify:dir fixtures/conformance/v0.1 --out reports/ci-report.json` (badge + JSON).
- Determinism check: ensure reported `version` is `0.1` and `determinismHash` matches CI output.

## 4) Decide (5 minutes)
- **Security posture:** Review [`SECURITY_HARDENING.md`](../SECURITY_HARDENING.md) and [`SECURITY_SYNC_STATUS.md`](../SECURITY_SYNC_STATUS.md) for current controls.
- **Integration fit:** Confirm LTP only requires frame-level transport; no storage or ML dependencies.
- **Interop readiness:** Ensure your stack can emit and accept the frozen v0.1 frames without mutation.

## Entry points by role
- **Node implementers:** start with [`nodes/`](../nodes) and [`specs/LTP-Canonical-Flow-v0.1.md`](../specs/LTP-Canonical-Flow-v0.1.md); use the conformance fixtures as acceptance tests.
- **Client developers:** use [`sdk`](../sdk) packages and the canonical demo commands; validate against `ok_basic_flow.json`.
- **Agent builders:** follow the canonical flow to keep routing explainable; lean on `route_response` branches (`primary`, `recover`, `explore`) and log warnings for unknown frame types.
- **HUD / monitor authors:** use the demo HUD commands (`npm run ltp:monitor` or `npm run dev:gateway`) and read [`specs/LTP-ConsciousnessWeb.md`](../specs/LTP-ConsciousnessWeb.md) for focus/mode semantics.

## Approval checklist (printable)
- [ ] Able to run `demo:canonical-v0.1` and see the exact frozen frame sequence.
- [ ] Conformance `verify` and `verify:dir` complete with expected pass/warn/fail outcomes.
- [ ] `version` reported as `0.1` and matches CI badge hash.
- [ ] No requirement for storage, ML, or external orchestration to use LTP.
- [ ] Security controls reviewed; alignment with your threat model confirmed.

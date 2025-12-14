# LTP Services (Neutral Overview)

These services help teams adopt and operate LTP without altering the protocol surface. They are optional and protocol-neutral.

## Conformance and assurance
- **Conformance audit:** run `verify` and `verify:dir` against your implementations; produce JSON reports and badge artifacts for CI.
- **Interop review:** check frame ordering, required fields, and handling of `primary / recover / explore` branches across SDKs.
- **Security posture review:** compare your deployment to [`SECURITY_HARDENING.md`](../SECURITY_HARDENING.md) and align mitigations.

## Integration support
- **SDK integration:** pair programming or code review to ensure clients and agents emit the frozen v0.1 frames without mutation.
- **Node enablement:** configure transport endpoints (HTTP/WS), logging, and observability for the canonical flow.
- **Migration assistance:** move from ad-hoc routing flows to the LTP canonical sequence while keeping existing transports.

## HUD and observability
- **HUD implementation:** build or adapt heads-up displays using existing HUD demos (`npm run ltp:monitor`, `npm run dev:gateway`).
- **Explainability surfacing:** expose route decisions and determinism hashes in your monitoring stack.

## Operating model
- Services are scoped to the protocol; no proprietary extensions or marketing claims.
- Engagements should produce reproducible artifacts (reports, configuration snippets, or demo outputs) aligned with the frozen v0.1 contract.

# LTP Production Readiness Baseline

> This report is generated from `tests/production/readiness-baseline.json`. The JSON manifest is the source of truth.

- **Baseline ID:** `ltp-production-readiness-wp1-2026-07-30`
- **Captured from commit:** `e0323c4e1c12091cc2b2cfd057c2c4566da8e7f5`
- **Synchronized SDK version:** `0.6.0-alpha.3`
- **Production-readiness epic:** #498

## What this baseline means

The repository now contains an independent LTP reference server with deterministic real-WebSocket scenarios. The server does not import any SDK implementation and proves authenticated handshake/resume, business traffic, ping/pong, encrypted metadata and fail-closed rejection paths with redacted evidence.

It still does **not** prove production readiness or four-SDK interoperability. JavaScript, Python, Rust and Elixir must each run the same reference scenarios in #501.

## Status legend

- **PROVEN** — executable evidence exists and runs in mandatory CI.
- **PARTIAL** — implementation or evidence exists, but a stated production proof is missing.
- **MISSING** — the required implementation or proof does not exist yet.
- **STALE** — an older claim no longer describes the current baseline.
- **NOT_APPLICABLE** — repository-level tooling rather than a native SDK feature.

## SDK and runtime baseline

| SDK | Version | Runtime | Native test command |
|---|---|---|---|
| JavaScript | `0.6.0-alpha.3` | Node.js >=18 | `cd sdk/js && npm test` |
| Python | `0.6.0-alpha.3` | Python >=3.9 | `cd sdk/python && python -m pytest tests/` |
| Rust | `0.6.0-alpha.3` | Rust stable, edition 2021 | `cd sdk/rust/ltp-client && cargo test` |
| Elixir | `0.6.0-alpha.3` | Elixir ~>1.14 / OTP 25 in CI | `cd sdk/elixir && mix test --trace` |

## Workflow evidence

| Workflow | Status | Scope |
|---|---|---|
| `sdk-matrix` | **PROVEN** | Native SDK suites, type consistency, conformance smoke, inspector and RC1 checks in `.github/workflows/test.yml`. |
| `p0-security` | **PROVEN** | Canonical bytes, receive atomicity, authenticated controls and resume-state security in `.github/workflows/p0-security-regressions.yml`. |
| `security-baseline` | **PROVEN** | Gitleaks and CodeQL for JavaScript, Python and Rust in `.github/workflows/security.yml`. |
| `reference-server` | **PROVEN** | Independent oracle, deterministic real-socket scenarios, evidence redaction and artifact upload in `.github/workflows/reference-server.yml`. |

## Capability matrix

| Capability | JavaScript | Python | Rust | Elixir | Production proof still missing |
|---|---|---|---|---|---|
| `handshake-session-establishment` | PARTIAL | PARTIAL | PARTIAL | PARTIAL | The independent server exists; SDK adapters remain in #501. |
| `independent-reference-server` | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | — |
| `canonical-envelope-v1` | PROVEN | PROVEN | PROVEN | PROVEN | — |
| `signature-replay-hash-chain` | PROVEN | PROVEN | PROVEN | PROVEN | The oracle proves wire rejection; four-SDK runs remain in #501. |
| `authenticated-control-frames` | PROVEN | PROVEN | PROVEN | PROVEN | — |
| `resume-security-state` | PROVEN | PROVEN | PROVEN | PROVEN | Crash/restart and concurrent reconnect injection: #502. |
| `metadata-encryption` | PARTIAL | PARTIAL | PARTIAL | PARTIAL | The oracle scenario exists; four-SDK encrypted-metadata E2E remains in #501. |
| `cross-sdk-type-consistency` | PROVEN | PROVEN | PROVEN | PROVEN | Behavioral wire interoperability is separate: #501. |
| `real-socket-interoperability` | MISSING | MISSING | MISSING | MISSING | The server/catalog exist; four SDK adapters and matrix remain in #501. |
| `conformance-report-generation` | PROVEN | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | Repository-level tool, not four native generators. |
| `semantic-inspector` | PROVEN | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | — |

## Evidence index

### `handshake-session-establishment`

Implementations exist in all four SDKs. `tools/reference-server/server.ts` now provides an independent authenticated server-side state machine. Status remains PARTIAL until #501 connects every SDK to it.

### `independent-reference-server`

`tools/reference-server/protocol.ts` independently implements canonical JSON, HMAC, P-256 ECDH, HKDF, AES-GCM, routing tags and hash commitments. `server.ts` owns the state machine, `scenarios.ts` drives real sockets and `referenceServer.test.ts` proves deterministic replay and evidence redaction. The `reference-server` workflow publishes the evidence artifact.

### `canonical-envelope-v1`

The shared vector is `tests/security/canonical-envelope-v1.json`. Native tests exist in all four SDKs, while cross-SDK regression logic runs in `p0-security`.

### `signature-replay-hash-chain`

Native tests prove atomic inbound security boundaries. The reference server additionally rejects invalid signatures, stale timestamps, replayed nonces and broken chains before inbound state commit over real WebSocket frames.

### `authenticated-control-frames`

Native SDK tests and the reference scenario catalog prove that post-handshake ping/pong use the negotiated session key.

### `resume-security-state`

The normative state model is documented in `docs/security/SESSION_CONTROL_AND_RESUME_STATE.md`. The reference scenario preserves both directions of the hash chain and replay state across an authenticated same-session resume. Extended fault/crash evidence belongs to #502.

### `metadata-encryption`

The reference server executes an AES-256-GCM encrypted-metadata and routing-tag round trip. SDK status remains PARTIAL until each implementation runs the shared scenario in #501.

### `cross-sdk-type-consistency`

`tests/cross-sdk/verify-types.js` runs in `sdk-matrix`. This proves declared type consistency, not runtime interoperability.

### `real-socket-interoperability`

The independent server and scenario catalog are now proven, but no SDK adapter matrix exists yet. #501 owns that remaining evidence.

### `conformance-report-generation`

Repository tooling is described by `docs/conformance/report-schema-v0.1.md`, implemented by `scripts/verify/validateConformanceReport.ts` and exercised in `sdk-matrix`.

### `semantic-inspector`

Inspector contract and matrix tests run from `tools/ltp-inspect`, with packaged CLI smoke checks across supported Node versions.

## Existing issue reconciliation

| Issue | Assessment | Disposition | Follow-up | Reason |
|---|---|---|---|---|
| #419 | PARTIAL | NARROW | #501 | The capability matrix and independent server exist; four-SDK wire interoperability remains. |
| #420 | PROVEN | CLOSE | #505 | Positive and negative cryptographic contracts run in mandatory CI; fuzz expansion remains separate. |
| #425 | PROVEN | CLOSE | #501 | Mandatory CI runs cross-SDK types, canonical contracts, native suites and conformance validation without secrets. |

## Open production-readiness gaps

- #501 four-SDK real-wire interoperability matrix.
- #502 deterministic fault, reconnect race and crash/restart testing.
- #503 measured load, soak, backpressure and resource limits.
- #504 version negotiation and migration policy.
- #505 property-based and fuzz assurance.
- #506 reproducible signed release engineering.
- #507 observability, SLOs and incident response.
- #508 independent audit and v1.0 go/no-go.

## Explicit non-claims

This baseline does **not** claim that LTP is production-ready, that the four SDKs are wire-interoperable, or that performance and resilience limits are known. The reference server is an oracle and test harness, not a production deployment template.

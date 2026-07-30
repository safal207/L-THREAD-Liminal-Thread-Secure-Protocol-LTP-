# LTP Production Readiness Baseline

> This report is generated from `tests/production/readiness-baseline.json`. The JSON manifest is the source of truth.

- **Baseline ID:** `ltp-production-readiness-wp2-2026-07-30`
- **Captured from commit:** `2059d207c5f73029c46fd620c75e96b324d751be`
- **Synchronized SDK version:** `0.6.0-alpha.3`
- **Production-readiness epic:** #498

## What this baseline means

JavaScript, Python, Rust and Elixir now execute the same ten positive and negative scenarios against one SDK-independent LTP reference server over real WebSocket connections. The resulting matrix contains 40 server-owned verdicts, with frame and state digests and no SDK self-certification.

This proves the shared handshake, authenticated business/control traffic, encrypted routing metadata, replay/freshness/hash-chain rejection and same-session resume profile. It does **not** yet prove crash resilience, load limits, version migration, release provenance, operational readiness or final v1.0 audit approval.

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
| `sdk-matrix` | **PROVEN** | Native SDK suites, type consistency, conformance smoke, inspector and RC1 checks. |
| `p0-security` | **PROVEN** | Canonical bytes, receive atomicity, authenticated controls and resume-state security. |
| `security-baseline` | **PROVEN** | Gitleaks and CodeQL for JavaScript, Python and Rust. |
| `reference-server` | **PROVEN** | Independent oracle, deterministic reference scenarios and the four-SDK real-socket matrix with redacted artifacts. |

## Capability matrix

| Capability | JavaScript | Python | Rust | Elixir | Remaining production proof |
|---|---|---|---|---|---|
| `handshake-session-establishment` | PROVEN | PROVEN | PROVEN | PROVEN | — |
| `independent-reference-server` | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | — |
| `canonical-envelope-v1` | PROVEN | PROVEN | PROVEN | PROVEN | — |
| `signature-replay-hash-chain` | PROVEN | PROVEN | PROVEN | PROVEN | — |
| `authenticated-control-frames` | PROVEN | PROVEN | PROVEN | PROVEN | — |
| `resume-security-state` | PROVEN | PROVEN | PROVEN | PROVEN | Crash/restart and reconnect-race injection: #502. |
| `metadata-encryption` | PROVEN | PROVEN | PROVEN | PROVEN | — |
| `cross-sdk-type-consistency` | PROVEN | PROVEN | PROVEN | PROVEN | — |
| `real-socket-interoperability` | PROVEN | PROVEN | PROVEN | PROVEN | — |
| `conformance-report-generation` | PROVEN | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | Repository-level tool, not four native generators. |
| `semantic-inspector` | PROVEN | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | — |

## Evidence index

### `handshake-session-establishment`

All four native adapters establish authenticated sessions against `tools/reference-server/server.ts`. The server—not the adapters—records the accepted handshake verdicts.

### `independent-reference-server`

`tools/reference-server/protocol.ts` independently implements canonical JSON, HMAC, P-256 ECDH, HKDF, AES-GCM, routing tags and hash commitments. `server.ts` owns the state machine and `scenarios.ts` proves deterministic positive and negative behavior.

### `canonical-envelope-v1`

The shared vector is `tests/security/canonical-envelope-v1.json`. WP2 additionally fixed real-wire drift in nonce format, routing-tag key encoding and the canonical inclusion of `meta` and `content_encoding`.

### `signature-replay-hash-chain`

Each SDK passes invalid-signature, stale-timestamp, replayed-nonce and broken-chain scenarios. Commitments are calculated over the exact wire envelope while signatures are checked over the logical decrypted view.

### `authenticated-control-frames`

Each SDK completes authenticated ping/pong. The Elixir heartbeat path has a native callback test proving that WebSockex sends the frame through a supported `{:reply, frame, state}` return.

### `resume-security-state`

Every SDK resumes the same thread/session namespace and then sends a valid post-resume event without resetting the chain. Extended fault/crash evidence belongs to #502.

### `metadata-encryption`

Each SDK completes an AES-256-GCM routing-metadata round trip. Routing tags use decoded session-key bytes consistently across all implementations.

### `cross-sdk-type-consistency`

`tests/cross-sdk/verify-types.js` continues to prove declared type consistency. WP2 supplies the separate runtime behavioral proof.

### `real-socket-interoperability`

`tests/e2e/four-sdk/run-matrix.ts` launches four native SDK processes against one server and produces `docs/production/FOUR_SDK_INTEROPERABILITY.md`. The validated result is **40 passed, 0 failed**.

### `conformance-report-generation`

Repository-level tooling now generates both the existing conformance report and the server-owned four-SDK interoperability evidence artifact.

### `semantic-inspector`

Inspector contract and matrix tests run from `tools/ltp-inspect`, with packaged CLI smoke checks across supported Node versions.

## Existing issue reconciliation

| Issue | Assessment | Disposition | Follow-up | Reason |
|---|---|---|---|---|
| #419 | PROVEN | CLOSE | #502 | All four native SDKs pass the shared real-socket scenario matrix. |
| #420 | PROVEN | CLOSE | #505 | Positive and negative cryptographic contracts run in mandatory CI. |
| #425 | PROVEN | CLOSE | #502 | Mandatory CI includes native suites, canonical contracts, reference scenarios and the four-SDK wire matrix without secrets. |

## Open production-readiness gaps

- #502 deterministic fault, reconnect race and crash/restart testing.
- #503 measured load, soak, backpressure and resource limits.
- #504 version negotiation and migration policy.
- #505 property-based and fuzz assurance.
- #506 reproducible signed release engineering.
- #507 observability, SLOs and incident response.
- #508 independent audit and v1.0 go/no-go.

## Explicit non-claims

This baseline does **not** claim that LTP is production-ready, that performance and resilience limits are known, or that the current dual wire versions (`0.3` and `0.6`) have a final migration policy. Those proofs remain in WP3–WP9.

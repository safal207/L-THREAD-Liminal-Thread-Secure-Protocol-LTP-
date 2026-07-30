# LTP Production Readiness Baseline

> This report is generated from `tests/production/readiness-baseline.json`. The JSON manifest is the source of truth.

- **Baseline ID:** `ltp-production-readiness-wp0-2026-07-30`
- **Captured from commit:** `40c9c406c2455276a2d90910ce7e78b6d26b638c`
- **Synchronized SDK version:** `0.6.0-alpha.3`
- **Production-readiness epic:** #498

## What this baseline means

The repository has a materially stronger security baseline than its older status documents suggested: four SDKs share Canonical Envelope v1, mandatory native suites, atomic inbound state transitions, authenticated post-handshake controls and same-session resume protection.

It does **not** yet prove production readiness. In particular, it does not prove that four independent clients behave identically against one real reference server under faults and load.

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

## Capability matrix

| Capability | JavaScript | Python | Rust | Elixir | Production proof still missing |
|---|---|---|---|---|---|
| `handshake-session-establishment` | PARTIAL | PARTIAL | PARTIAL | PARTIAL | Shared real-socket reference-server proof: #500 and #501. |
| `canonical-envelope-v1` | PROVEN | PROVEN | PROVEN | PROVEN | — |
| `signature-replay-hash-chain` | PROVEN | PROVEN | PROVEN | PROVEN | Shared real-wire negative scenarios: #501. |
| `authenticated-control-frames` | PROVEN | PROVEN | PROVEN | PROVEN | — |
| `resume-security-state` | PROVEN | PROVEN | PROVEN | PROVEN | Crash/restart and concurrent reconnect injection: #502. |
| `metadata-encryption` | PARTIAL | PARTIAL | PARTIAL | PARTIAL | Shared encrypted-metadata E2E scenario: #501. |
| `cross-sdk-type-consistency` | PROVEN | PROVEN | PROVEN | PROVEN | Behavioral wire interoperability is separate: #501. |
| `real-socket-interoperability` | MISSING | MISSING | MISSING | MISSING | Reference server #500 and E2E matrix #501. |
| `conformance-report-generation` | PROVEN | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | Repository-level tool, not four native generators. |
| `semantic-inspector` | PROVEN | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | — |

## Evidence index

### `handshake-session-establishment`

Implementations exist in `sdk/js/src/client.ts`, `sdk/python/ltp_client/client.py`, `sdk/rust/ltp-client/src/client.rs` and `sdk/elixir/lib/ltp/connection.ex`. Native compilation and tests run in `sdk-matrix`. Status remains PARTIAL because one independent server has not exercised all four implementations over real sockets.

### `canonical-envelope-v1`

The shared vector is `tests/security/canonical-envelope-v1.json`. Native tests exist in all four SDKs, while cross-SDK regression logic runs in `p0-security`.

### `signature-replay-hash-chain`

Evidence includes `tests/security/p0/test_p0_security_regressions.py`, Python receive-atomicity tests, the Rust live receive pipeline, Elixir authentication-before-dispatch tests and JavaScript security paths. State mutation follows successful authentication and chain validation.

### `authenticated-control-frames`

Evidence includes `tests/security/test_control_resume_contracts.py` plus native JavaScript, Python, Rust and Elixir tests. Unsigned or replayed `pong` cannot change liveness state.

### `resume-security-state`

The normative state model is documented in `docs/security/SESSION_CONTROL_AND_RESUME_STATE.md`. Native tests prove same-session preservation and fresh-session reset. Extended fault and crash evidence belongs to #502.

### `metadata-encryption`

Implementations exist in the four crypto modules. Status is PARTIAL because there is no single real-wire scenario comparing encryption, routing tags, decryption and rejection behavior across all SDKs.

### `cross-sdk-type-consistency`

`tests/cross-sdk/verify-types.js` runs in `sdk-matrix`. This proves declared type consistency, not runtime interoperability.

### `real-socket-interoperability`

Evidence: **none yet**. #500 creates the independent server and #501 creates the scenario × SDK matrix.

### `conformance-report-generation`

Repository tooling is described by `docs/conformance/report-schema-v0.1.md`, implemented by `scripts/verify/validateConformanceReport.ts` and exercised in `sdk-matrix`.

### `semantic-inspector`

Inspector contract and matrix tests run from `tools/ltp-inspect`, with packaged CLI smoke checks across supported Node versions.

## Existing issue reconciliation

| Issue | Assessment | Disposition | Follow-up | Reason |
|---|---|---|---|---|
| #419 | PARTIAL | NARROW | #501 | The source/test compatibility matrix now exists, but wire-level interoperability remains missing. |
| #420 | PROVEN | CLOSE | #505 | Positive and negative cryptographic contracts run in mandatory CI; fuzz expansion remains separate. |
| #425 | PROVEN | CLOSE | #501 | Mandatory CI already runs cross-SDK types, canonical contracts, native suites and conformance validation without secrets. |

## Open production-readiness gaps

- #500 independent reference server and deterministic E2E harness.
- #501 four-SDK real-wire interoperability matrix.
- #502 deterministic fault, reconnect race and crash/restart testing.
- #503 measured load, soak, backpressure and resource limits.
- #504 version negotiation and migration policy.
- #505 property-based and fuzz assurance.
- #506 reproducible signed release engineering.
- #507 observability, SLOs and incident response.
- #508 independent audit and v1.0 go/no-go.

## Explicit non-claims

This baseline does **not** claim that LTP is production-ready, that the four SDKs are wire-interoperable, or that performance and resilience limits are known. Those claims become available only after the dependent production-readiness work packages are completed with reproducible evidence.

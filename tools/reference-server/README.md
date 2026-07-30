# LTP Reference Server

This directory contains the independent protocol oracle created for production-readiness WP1 / #500.

## Purpose

The reference server exercises LTP over real WebSocket frames without importing JavaScript, Python, Rust or Elixir SDK code. Its job is to provide one deterministic state machine for later four-SDK interoperability, fault injection and load work.

It is **not** a production deployment template. It intentionally uses in-memory session state, one process and deterministic test sources.

## Implemented protocol surface

- `handshake_init` with authenticated P-256 ECDH;
- `handshake_resume` preserving the same authenticated session namespace;
- server ECDH key authentication;
- Canonical Envelope v1 HMAC signatures;
- timestamp freshness, replay cache and hash-chain checks before state commit;
- authenticated `ping` / `pong`;
- business-frame acknowledgment;
- AES-256-GCM encrypted metadata and routing tags;
- stable rejection codes;
- redacted evidence containing digests and state commitments, never keys or raw payloads.

The runtime protocol surface currently uses `ltp_version: "0.3"` and WebSocket subprotocol `ltp.v0.3`, matching the current SDK runtime constants. Package versions (`0.6.0-alpha.3`) are tracked separately; version-governance cleanup belongs to #504.

## Run locally

Install repository dependencies once:

```bash
pnpm install --frozen-lockfile
```

Start the server:

```bash
pnpm reference:server
```

Run the deterministic scenario catalog and write evidence:

```bash
pnpm reference:scenarios
```

Run the WP1 contract tests:

```bash
pnpm test:reference-server
```

## Scenario catalog

1. Fresh authenticated handshake.
2. Business-message round trip.
3. Authenticated ping/pong.
4. Encrypted-metadata round trip.
5. Invalid signature rejection.
6. Stale timestamp rejection.
7. Replayed nonce rejection.
8. Broken hash-chain rejection.
9. Same-session authenticated resume.
10. Replay rejection after resume.
11. Business traffic after resume.
12. Unsupported-version rejection.

The same seed must produce the same scenario order, verdicts, frame digests and state digests.

## Evidence format

`pnpm reference:scenarios` writes `artifacts/reference-server-evidence.json` with:

- scenario ID and expected/actual result;
- direction and frame type;
- stable reason code;
- SHA-256 frame digest;
- thread/session identifiers;
- security-state digest after accepted commits.

Raw frames, long-term secrets, session MAC keys, encryption keys and private ECDH keys are never written to evidence.

## Boundary with WP2

WP1 proves the independent server and deterministic wire harness. It does not yet prove that every SDK passes the catalog. JavaScript, Python, Rust and Elixir adapters are added in #501.

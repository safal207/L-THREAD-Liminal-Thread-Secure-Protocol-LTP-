# LTP Four-SDK Wire Interoperability

> Generated from `artifacts/four-sdk-interoperability.json`. Verdicts come from the independent reference server, not from SDK self-reporting.

| Scenario | JavaScript | Python | Rust | Elixir |
|---|---|---|---|---|
| fresh-handshake | PASS | PASS | PASS | PASS |
| business | PASS | PASS | PASS | PASS |
| ping-pong | PASS | PASS | PASS | PASS |
| encrypted | PASS | PASS | PASS | PASS |
| invalid-signature | PASS | PASS | PASS | PASS |
| stale-timestamp | PASS | PASS | PASS | PASS |
| replayed-nonce | PASS | PASS | PASS | PASS |
| broken-chain | PASS | PASS | PASS | PASS |
| same-session-resume | PASS | PASS | PASS | PASS |
| post-resume | PASS | PASS | PASS | PASS |

## Negotiated wire versions

- **javascript:** `0.3`
- **python:** `0.3`
- **rust:** `0.6`
- **elixir:** `0.6`

## Interpretation

A PASS means the native SDK process completed the action and the independent server recorded the expected accepted or rejected protocol boundary with frame/state digests.
Package versions remain synchronized at `0.6.0-alpha.3`; current wire versions are `0.3` for JavaScript/Python and `0.6` for Rust/Elixir. Formal convergence and migration policy are tracked by #504.

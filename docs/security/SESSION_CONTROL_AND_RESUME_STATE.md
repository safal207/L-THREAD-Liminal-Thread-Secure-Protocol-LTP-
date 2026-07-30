# Session control authentication and resume state

Post-handshake `ping` and `pong` are authenticated protocol messages, not transport hints.
They use the negotiated session MAC key, canonical envelope bytes, fresh nonces, replay
protection, and the same hash-chain commitment as business frames. An unsigned or stale
`pong` cannot update liveness state.

## Resume invariant

A transport reconnect does not create a new security namespace. An authenticated resume
of the same `session_id` restores the committed receive hash and replay cache. A fresh
session or rejected resume explicitly resets them. Old receive owners are invalidated
before a replacement owner can commit.

## Persistence format

- JavaScript stores a versioned JSON record under `ltp_security_state:<client_id>`.
- Python stores a versioned `security_state` object beside thread/session identifiers.
- Rust exposes `ReceiveSecuritySnapshot` for application-controlled durable storage.
- Elixir accepts restored `last_sent_hash`, `last_received_hash`, `seen_nonces`, and
  `security_state_initialized` options. Without restored state it starts a fresh handshake
  instead of silently resuming an old session.

The snapshot namespace is bound to the session ID. Unknown versions, mismatched sessions,
or absent state fail closed and require a new authenticated session.

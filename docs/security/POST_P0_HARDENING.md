# Post-P0 security hardening

The confirmed P0 regressions are covered by executable contracts. The control-plane
and lifecycle items below are now implemented and protected by native and cross-SDK
regression tests. See `SESSION_CONTROL_AND_RESUME_STATE.md` for the normative state model.

## Authenticate ping/pong after handshake — completed

Current SDK compatibility paths treat ping and pong as protocol control frames and
may bypass the business-frame HMAC/replay/hash pipeline. A forged pong can therefore
influence liveness state without proving session possession.

Required completion evidence:

- handshake-time control frames remain possible before session keys exist;
- post-handshake ping/pong are signed with the negotiated session MAC key;
- post-handshake ping/pong carry fresh, non-replayed nonces;
- an unauthenticated pong cannot reset a heartbeat timeout;
- equivalent tests exist in JavaScript, Python, Rust, and Elixir.

## Preserve receive security state across reconnect/resume — completed

Some live receive loops own `last_received_hash` and replay-cache state inside a
spawned task. Reconnect or task replacement must not silently reset the committed
security boundary for a resumed session.

Required completion evidence:

- session resume restores the expected receive-chain commitment;
- replay cache remains scoped to the resumed session and cannot be reset by reconnect;
- a fresh handshake explicitly resets state only after authenticated session change;
- concurrent old/new receive tasks cannot both commit state;
- reconnect race tests exist for every asynchronous SDK.

## Review status

Both items are enforced by executable regression tests. Future changes must preserve
the negotiated-session control key, replay namespace, hash commitment, and single receive
owner semantics.

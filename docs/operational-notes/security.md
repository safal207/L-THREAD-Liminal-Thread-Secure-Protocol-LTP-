# Security hardening (v0.1)

## API key handshake
- The node expects a `hello` message carrying `api_key`.
- Configure keys with `LTP_API_KEYS` (comma-separated) or `LTP_API_KEY` (single).
- On success, the server assigns a new `session_id` and returns it in `hello_ack`.
- On failure, the server responds with `error` `code=UNAUTHORIZED` and closes the connection.

## Per-connection rate limiting
- Each WebSocket connection uses a token bucket.
- Defaults: `20` requests/second with a `40` message burst (`LTP_RATE_LIMIT_RPS`, `LTP_RATE_LIMIT_BURST`).
- Exceeding the budget yields `error` `code=RATE_LIMIT` and the connection is closed.

## Sampled error logging
- JSON parse / malformed message errors are sampled to at most once per second per connection.
- Suppressed error counts are included in the sampled log entry to keep behavior auditable.

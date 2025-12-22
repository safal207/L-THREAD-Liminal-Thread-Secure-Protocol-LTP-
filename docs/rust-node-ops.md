# Rust LTP node hardening/ops notes

## Runtime configuration

All values are read from the environment (defaults in parentheses):

| Env var | Purpose |
| --- | --- |
| `LTP_NODE_ADDR` (`127.0.0.1:7070`) | WebSocket bind address |
| `LTP_NODE_ID` (random UUID) | Node identity advertised in `hello_ack` |
| `LTP_NODE_METRICS_ADDR` (`127.0.0.1:9090`) | Prometheus `/metrics` listener (bind to loopback by default; expose via a reverse proxy with TLS/origin/rate limiting) |
| `LTP_NODE_MAX_CONNECTIONS` (`10000`) | Concurrent TCP/WS connection cap |
| `LTP_NODE_MAX_MESSAGE_BYTES` (`131072`) | Incoming message size limit (hard drop) |
| `LTP_NODE_MAX_SESSIONS` (`50000`) | Total tracked sessions cap |
| `LTP_NODE_HANDSHAKE_TIMEOUT_MS` (`5000`) | Max time for WS handshake |
| `LTP_NODE_IDLE_TTL_MS` (`60000`) | Idle session TTL before GC |
| `LTP_NODE_GC_INTERVAL_MS` (`10000`) | GC sweep cadence |

## Observability

Metrics (Prometheus):

- `ltp_ws_connections_current` (gauge)
- `ltp_msgs_total{type}` (counter)
- `ltp_msg_rejected_total{reason}` (counter)
- `ltp_sessions_total` (gauge)
- `ltp_sessions_expired_total{reason}` (counter)
- `ltp_janitor_sweep_duration_seconds` (histogram)
- `ltp_janitor_skipped_lock_total` (counter)
- `ltp_janitor_expired_last_sweep` (gauge)
- `ltp_capacity_rejections_total` (counter)

Logs are emitted via `tracing` and include `remote_addr`, `client_id` (when known), and reasons for rejections/expiration.

## Lifecycle/GC rules

- WebSocket disconnect immediately removes the session.
- A janitor task runs every `LTP_NODE_GC_INTERVAL_MS` and expires sessions idle for `LTP_NODE_IDLE_TTL_MS`, incrementing `ltp_sessions_expired_total{reason="ttl"}`.
- Incoming heartbeats and valid messages bump `last_seen` for the session.
- Metrics endpoints should be exposed only through a reverse proxy or firewall that enforces TLS, origin, and rate limits.

# Rust LTP node hardening/ops notes

## Runtime configuration

All values are read from the environment (defaults in parentheses):

| Env var | Purpose |
| --- | --- |
| `LTP_NODE_ADDR` (`127.0.0.1:7070`) | WebSocket bind address |
| `LTP_NODE_ID` (random UUID) | Node identity advertised in `hello_ack` |
| `LTP_NODE_METRICS_ADDR` (`127.0.0.1:9090`) | Prometheus `/metrics` listener (bind to loopback by default; expose via a reverse proxy with TLS/origin/rate limiting) |
| `LTP_NODE_MAX_CONNECTIONS` (`10000`) | Concurrent TCP/WS connection cap |
| `LTP_NODE_MAX_MESSAGE_BYTES` (`65536`) or `MAX_MESSAGE_BYTES` (`65536`) | Incoming message size limit (hard drop) |
| `LTP_NODE_MAX_SESSIONS` (`50000`) | Total tracked sessions cap |
| `LTP_NODE_HANDSHAKE_TIMEOUT_MS` (`5000`) | Max time for WS handshake |
| `LTP_NODE_IDLE_TTL_MS` (`60000`) | Idle session TTL before GC |
| `LTP_NODE_GC_INTERVAL_MS` (`10000`) | GC sweep cadence |
| `RATE_LIMIT_RPS` (`10`) | Per-connection rate (tokens/sec) before closing a noisy peer |
| `RATE_LIMIT_BURST` (`20`) | Allowed burst tokens before rate limiting triggers |
| `IP_RATE_LIMIT_RPS` (`5`) | Per-IP token bucket rate |
| `IP_RATE_LIMIT_BURST` (`10`) | Per-IP burst tokens |
| `IP_RATE_LIMIT_TTL_SECS` (`600`) | TTL for idle per-IP limiter entries |
| `AUTH_MODE` (`none`) | `none` (default) or `api_key`; `jwt` is reserved but not implemented |
| `AUTH_KEYS` | Comma-separated `id:key` pairs when `AUTH_MODE=api_key` |
| `AUTH_KEYS_FILE` | Path to JSON object mapping client IDs to API keys (takes precedence over `AUTH_KEYS` when readable) |
| `AUTH_KEYS_RELOAD_INTERVAL_SECS` (`30`) | Reload cadence for `AUTH_KEYS_FILE` when present |
| `AUTH_JWT_SECRET` | Reserved for JWT support (currently rejected if `AUTH_MODE=jwt`) |
| `TRUST_PROXY` (`false`) | Honor `X-Forwarded-For` for per-IP limiting when behind a trusted proxy |

## Observability

Metrics (Prometheus):

- `ltp_ws_connections_current` (gauge)
- `ltp_msgs_total{type}` (counter)
- `ltp_msg_rejected_total{reason}` (counter)
- `ltp_sessions_total` (gauge)
- `ltp_sessions_expired_total{reason}` (counter)
- `ws_invalid_json_total` (counter)
- `ws_invalid_json_suppressed_total` (counter)
- `rate_limit_violations_total` (counter)
- `ip_rate_limit_violations_total` (counter)
- `oversize_messages_total` (counter)
- `auth_failures_total` (counter)
- `auth_keys_reload_success_total` / `auth_keys_reload_failure_total` (counters)
- `auth_keys_active` (gauge)
- `log_suppressed_total{category}` (counter)

Logs are emitted via `tracing` and include `remote_addr`, `client_id` (when known), and reasons for rejections/expiration.
Invalid JSON/binary message warnings are throttled to once per second per connection; suppressed logs still increment counters.

## Lifecycle/GC rules

- WebSocket disconnect immediately removes the session.
- A janitor task runs every `LTP_NODE_GC_INTERVAL_MS` and expires sessions idle for `LTP_NODE_IDLE_TTL_MS`, incrementing `ltp_sessions_expired_total{reason="ttl"}`.
- Incoming heartbeats and valid messages bump `last_seen` for the session.

## Authentication

- Default: `AUTH_MODE=none`, and the node behaves as before.
- API key mode: set `AUTH_MODE=api_key` and provide keys via `AUTH_KEYS` (e.g., `user1:secret1,user2:secret2`) or `AUTH_KEYS_FILE` (JSON map of `{ "user1": "secret1" }`). `AUTH_KEYS_FILE` takes precedence when readable; failures to read in API key mode are fail-closed.
- Keys reload automatically when `AUTH_KEYS_FILE` is present, on a hash change or mtime change cadence set by `AUTH_KEYS_RELOAD_INTERVAL_SECS`.
- Clients must send the key in `X-API-Key: <key>` or `Authorization: Bearer <key>` during the WebSocket handshake. The server derives `client_id` from the key’s configured ID and ignores any client-supplied `client_id`.
- Connections missing/with invalid credentials fail the handshake and increment `auth_failures_total`.

## Rate limiting

- Each connection enforces a token-bucket limiter before parsing inbound messages.
- Defaults allow 10 msgs/sec with a burst of 20; configure via `RATE_LIMIT_RPS` and `RATE_LIMIT_BURST`.
- Per-IP token bucket: configure via `IP_RATE_LIMIT_RPS`, `IP_RATE_LIMIT_BURST`; idle entries expire after `IP_RATE_LIMIT_TTL_SECS`.
- When exceeded, the server closes the connection with a policy error, increments `rate_limit_violations_total` (per-connection) or `ip_rate_limit_violations_total`, and counts the rejection in `ltp_msg_rejected_total{reason="rate_limit"}`.

# LTP Rust Node Security Profile

## Threat model overview

- **API key misuse & identity spoofing** – Identity is derived from validated API keys (fail-closed when auth is enabled) and client-supplied identifiers are ignored when auth is active.
- **Flooding & amplification** – Per-connection and per-IP token buckets gate message throughput before payload parsing. Message size limits stop oversize frames early.
- **Log flooding** – Repeated parse/limit errors are sampled to avoid log amplification while still counting suppressed events.
- **Key exposure & rotation** – API keys load from a JSON file with periodic, hash-guarded reloads; failures are fail-closed when file-based auth is configured.
- **Operational observability** – Prometheus metrics cover auth reloads, rate-limit violations, oversize messages, and log suppression to assist incident analysis.

## Recommended production configuration

- Terminate TLS at a reverse proxy (Caddy/Nginx/Traefik) in front of the node; prefer HTTP/2 or HTTP/1.1 upgrade for WebSocket.
- Enable API-key auth:
  - `AUTH_MODE=api_key`
  - `AUTH_KEYS_FILE=/etc/ltp/auth_keys.json` (JSON object `{ "id": "key" }`)
  - `AUTH_KEYS_RELOAD_INTERVAL_SECS=30`
- Rate limits:
  - `RATE_LIMIT_RPS=10`, `RATE_LIMIT_BURST=20` (per-connection)
  - `IP_RATE_LIMIT_RPS=5`, `IP_RATE_LIMIT_BURST=10`, `IP_RATE_LIMIT_TTL_SECS=600`
- Message sizing:
  - `MAX_MESSAGE_BYTES=65536`
- Idle/session hygiene:
  - `LTP_NODE_IDLE_TTL_MS=60000`
  - `LTP_NODE_GC_INTERVAL_MS=10000`
- Proxy trust (optional):
  - Set `TRUST_PROXY=true` **only** when the reverse proxy scrubs/sets `X-Forwarded-For` and runs on a trusted network path.

## TLS and identity

- The node currently expects TLS termination at the proxy. Use HTTPS listeners on the proxy and forward to the node over localhost or a private network segment.
- Identity binding supports API keys today. An `IdentitySource::MtlsSubject` variant is reserved for future mTLS subject binding.

## What the LTP node does **not** do

- No business or decision logic: the node transports protocol messages only.
- No state mutation for downstream domains: routing suggestions are protocol-level only.
- No built-in persistence or vector/memory embeddings.
- No built-in TLS termination; rely on the reverse proxy.

## Reverse proxy notes

- Ensure `X-Forwarded-For` is forwarded if `TRUST_PROXY=true` is enabled; otherwise, the node uses the socket peer address for per-IP limits.
- Configure WebSocket upgrade pass-through on `/` with appropriate buffering disabled to reduce latency.

## Observability checklist

- Scrape the `/metrics` endpoint from Prometheus.
- Watch:
  - `auth_keys_reload_success_total` / `auth_keys_reload_failure_total`
  - `auth_keys_active`
  - `rate_limit_violations_total` and `ip_rate_limit_violations_total`
  - `oversize_messages_total`
  - `log_suppressed_total{category=...}`

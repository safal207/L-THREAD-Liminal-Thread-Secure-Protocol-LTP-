# Secure Deployment Guide

Deploying the LTP Rust Node in a production/fintech environment requires adherence to secure defaults.

## 1. Network Binding

By default, the node binds to `127.0.0.1:7070`. This prevents accidental exposure to the public internet.

**Recommendation:** strictly use a reverse proxy (Nginx, Caddy, AWS ALB) to terminate TLS and forward traffic to localhost.

## 2. Proxy Configuration (`TRUST_PROXY`)

If you are running behind a load balancer or reverse proxy that sets headers like `X-Forwarded-For`, you may need to enable `TRUST_PROXY=true` to correctly rate-limit client IPs.

**Security Requirement:**
If `TRUST_PROXY=true` is set, you **MUST** configure `LTP_ALLOW_PROXY_CIDR` with the CIDR ranges of your trusted proxies.

```bash
export TRUST_PROXY=true
export LTP_ALLOW_PROXY_CIDR=10.0.0.0/8,172.16.0.0/12
```

If `LTP_ALLOW_PROXY_CIDR` is missing when `TRUST_PROXY=true`, the node will **refuse to start** (unless `LTP_UNSAFE_TRUST_PROXY_ANY=true` is explicitly set, which is dangerous and not recommended for production).

## 3. Docker Compose

The provided `docker-compose.yml` binds ports to `127.0.0.1` by default.

```yaml
  ltp-server-rust:
    ports:
      - "127.0.0.1:7070:7070"  # Safe
      # - "0.0.0.0:7070:7070"  # Unsafe (Exposed)
```

## 4. Audit Logs

Ensure the `LTP_AUDIT_LOG_FILE` path is on a persistent, backed-up volume. Loss of this file means loss of the cryptographic audit trail.

## 5. Rate Limiting

Configure rate limits appropriate for your capacity:

- `RATE_LIMIT_RPS`: Requests per second per connection.
- `IP_RATE_LIMIT_RPS`: Requests per second per IP address.

See `config.rs` or `--help` for defaults.

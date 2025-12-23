# Security Baseline (v0.1)

This document defines the minimum security guarantees expected from any LTP node implementation that is exposed to untrusted networks.

> v0.1 goal: prevent trivial hijacking, flooding, and operational self-DoS.
> Not a full security model. A baseline.

---

## 1) Threats this baseline addresses

### Prevents (by baseline)
- Session hijacking via untrusted client-provided identity
- Application-level DoS via message flood (per-connection)
- Operational self-DoS via log flooding (malformed payload spam)
- Unbounded resource growth (idle session retention / leaks)

### Does NOT prevent (out of scope for v0.1)
- MITM without TLS (use reverse proxy TLS termination)
- Compromised client keys / stolen environment secrets
- Insider attacks (operator-level access)
- Sophisticated distributed DoS (needs infra-level mitigation)
- Full cryptographic identity / attestation / mTLS (v0.2+)

---

## 2) Required controls (MUST)

### A. Authentication at handshake
**MUST** reject sessions that do not provide valid credentials during protocol handshake.

- Identity must not be trusted if it is only client-supplied
- Server must derive/validate session identity from an authenticated claim

Minimal acceptable v0.1 options:
- static API key(s) via environment variables
- token passed in handshake frame payload

### B. Rate limiting (per connection)
**MUST** enforce application-level rate limits for message handling.

Recommended:
- Token Bucket
- allow reasonable bursts, enforce average throughput

Default suggestion:
- burst: 40 messages
- average: 20 msg/sec per connection
- on violation: close connection with a clear protocol error

### C. Sampled / throttled logging
**MUST** avoid log flooding on repeated malformed inputs or frequent protocol errors.

Recommended:
- at most 1 error log per second per connection for the same class of error
- include counters for suppressed logs (optional but useful)

### D. Idle session expiration / GC
**MUST** expire idle sessions to prevent unbounded memory growth.

Recommended:
- TTL: 5 minutes (configurable)
- GC interval: 60 seconds (configurable)
- report removed session count in logs/metrics

---

## 3) Deployment recommendation (SHOULD)

### TLS termination via reverse proxy
For v0.1, **SHOULD** terminate TLS at a reverse proxy (Nginx/Caddy/Traefik).

Reasons:
- mature certificate rotation and ciphers
- simpler node code and fewer crypto footguns
- easier debugging and traffic inspection on localhost

mTLS inside the node is a v0.2+ topic.

---

## 4) Operational notes (SHOULD)

- Expose metrics: active sessions, expired sessions, rate-limit violations, malformed frames
- Keep all limits configurable (env / config file)
- Prefer deterministic rejection behavior (same input ⇒ same rejection)

---

## 5) Conformance checklist (v0.1)

A node is "Security Baseline v0.1" compliant if:
- [ ] handshake auth enforced
- [ ] per-connection rate limiting enforced
- [ ] error log sampling implemented
- [ ] idle session TTL + GC present
- [ ] limits configurable

---

# Security Baseline (v0.1)

This document defines the minimum security guarantees expected from any LTP node implementation that is exposed to untrusted networks.

> v0.1 goal: prevent trivial hijacking, flooding, and operational self-DoS.
> Not a full security model. A baseline.

The baseline is framed in **attack classes and risk categories**, not vendor choices.
It distinguishes protocol guarantees (continuity + admissibility) from node controls
(products decide how they meet the controls).

---

## 1) Attack classes and risk categories

### Prevents (by baseline controls)
- **Identity spoofing as continuity breach**: unauthenticated client claims cannot become session identity.
- **Application-layer flooding**: per-connection message spikes cannot exhaust the node.
- **Observability exhaustion**: repeated malformed traffic cannot drown logs/metrics.
- **Resource retention**: idle or abandoned sessions cannot accumulate without limit.

### Outside baseline (remain product responsibilities)
- **Transport confidentiality/integrity**: protection against interception or tampering on plaintext channels.
- **Secret handling**: credential exposure or theft of secrets stored in the environment.
- **Operator misuse/insider risk**: privileged misuse beyond protocol reach.
- **Volumetric denial of service**: large-scale network floods require infrastructure mitigations.
- **Advanced identity**: mutual authentication, attestation, or hardware roots of trust (v0.2+ topics).

Baseline controls keep continuity and admissibility intact under hostile inputs.
They do not replace platform security programs.

---

## 2) Protocol guarantees vs node controls

- **Protocol (LTP Core) guarantees**: content is classified as untrusted events; admissibility gating precedes any action layer; replayable traces make violations auditable.
- **Node controls (this baseline)**: authentication, rate limits, log safety, and session GC prevent the node from being coerced into breaking those guarantees.

Both are required to keep the boundary real.

## 3) Required controls (MUST)

### A. Authentication at handshake
**MUST** reject sessions that do not provide valid credentials during protocol handshake.

- Identity must not be trusted if it is only client-supplied
- Server must derive/validate session identity from an authenticated claim

Minimal acceptable v0.1 options (product selects mechanism):
- static API key(s) via environment variables
- token passed in handshake frame payload

### B. Rate limiting (per connection)
**MUST** enforce application-level rate limits for message handling.

Recommended pattern (testable as a control, not a vendor lock):
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

## 4) Deployment recommendation (SHOULD)

### TLS termination via reverse proxy
For v0.1, **SHOULD** terminate TLS at a hardened edge layer such as a reverse proxy or load balancer.

Reasons:
- mature certificate rotation and ciphers
- simpler node code and fewer crypto footguns
- easier debugging and traffic inspection on localhost

mTLS inside the node is a v0.2+ topic.

---

## 5) Operational notes (SHOULD)

- Expose metrics: active sessions, expired sessions, rate-limit violations, malformed frames
- Keep all limits configurable (env / config file)
- Prefer deterministic rejection behavior (same input ⇒ same rejection)

---

## 6) Conformance checklist (v0.1)

A node is "Security Baseline v0.1" compliant if:
- [ ] handshake auth enforced
- [ ] per-connection rate limiting enforced
- [ ] error log sampling implemented
- [ ] idle session TTL + GC present
- [ ] limits configurable

---

# LTP Node Operational Hardening Audit (v0.1)

Scope: review of the Rust LTP node implementation for operational correctness, safety, and production readiness. Focused on background cleanup, concurrency and memory safety, lifecycle semantics, observability, and non-cryptographic security boundaries.

## 1) Background cleanup task correctness
- The janitor loop (`spawn_janitor`) runs forever with a fixed sleep interval and no shutdown signal; it will continue running across shutdown/ctrl-c until the runtime is torn down, which can leave a zombie task in tests or during graceful drains. 【F:nodes/ltp-rust-node/src/main.rs†L209-L229】【F:nodes/ltp-rust-node/src/main.rs†L462-L479】
- Cleanup is non-blocking: `expire_idle` uses `try_lock` on each session and skips busy locks, so the janitor does not block hot paths. 【F:nodes/ltp-rust-node/src/state.rs†L108-L134】
- TTL enforcement is racey: keys selected for removal are not revalidated after they are collected. A session can update `last_seen` after the initial `try_lock` but before removal, leading to possible eviction of an active session under high churn and short TTLs. 【F:nodes/ltp-rust-node/src/state.rs†L108-L134】
- Interval/TTL safety: fixed intervals with no jitter mean concurrent spikes could align cleanup work; long-held locks will delay expiry indefinitely because skipped sessions are never retried within the same sweep.

## 2) Concurrency and memory safety
- DashMap holds `Arc<Mutex<SessionState>>` entries; guards are awaited only while mutating `SessionState`, which keeps critical sections small. 【F:nodes/ltp-rust-node/src/state.rs†L53-L102】
- Iteration during mutation is limited to key collection for GC, but lack of re-check before removal can drop freshly-updated sessions (see above).
- Under reconnect storms, sessions are created before capacity checks; failed capacity checks immediately remove the inserted entry, avoiding unbounded growth, but all work happens post-insert, so the map is briefly over capacity and can churn under attack. 【F:nodes/ltp-rust-node/src/main.rs†L394-L449】【F:nodes/ltp-rust-node/src/main.rs†L481-L497】
- Idle expiry skips locked sessions; a malicious client that keeps its mutex contended (e.g., rapid Orientation updates) can delay eviction and keep memory occupied until disconnect.

## 3) Lifecycle and shutdown semantics
- Neither the metrics server nor janitor is tied to a shutdown signal or join handle. Graceful stop lacks coordination and could leave in-flight work unflushed. 【F:nodes/ltp-rust-node/src/main.rs†L164-L229】【F:nodes/ltp-rust-node/src/main.rs†L462-L479】
- The main accept loop never exits, and there is no backpressure mechanism for draining existing sessions before shutdown.

## 4) Observability and diagnostics
- Prometheus metrics cover connections, sessions, expired sessions (reasoned by TTL), total messages, and rejected messages. 【F:nodes/ltp-rust-node/src/main.rs†L89-L143】
- Missing signals: janitor run duration, scan count, and per-run expired count (only aggregate counter is exposed). There is no metric for capacity rejections or GC skips due to lock contention, and no histogram for cleanup latency.
- Tracing exists for connection lifecycle and expiry events, but not for janitor loop start/stop, lock-skipped expirations, or shutdown events.

## 5) Security boundaries (non-cryptographic)
- WebSocket acceptor runs without origin or TLS validation; deployment must rely on an external TLS-terminating reverse proxy for confidentiality and origin control. 【F:nodes/ltp-rust-node/src/main.rs†L238-L374】
- No rate limiting beyond session and connection caps; a proxy should enforce IP-level throttling and size limits to prevent churn/DoS.
- Metrics endpoint binds to `0.0.0.0` by default; without proxy isolation it is exposed to the network. 【F:nodes/ltp-rust-node/src/main.rs†L164-L197】

## Prioritized risks
- **High:** Janitor never revalidates TTL before removal, enabling eviction of active sessions under churn and short TTL/intervals.
- **High:** No coordinated shutdown; janitor and metrics tasks ignore stop signals, risking zombie tasks and incomplete cleanup.
- **Medium:** Idle expiry skips locked sessions indefinitely, allowing a busy or malicious session to avoid TTL-based eviction and consume memory.
- **Medium:** Metrics endpoint binds publicly by default; exposure depends on external reverse proxy configuration.
- **Low:** Cleanup interval is fixed with no jitter, which can align with traffic bursts and cause periodic contention.

## Recommendations (minimal changes)
1) **Add cooperative shutdown:** Pass a cancellation token or `watch` channel into the janitor and metrics tasks and await it in the loop to guarantee deterministic termination.
2) **Revalidate before removal:** When expiring sessions, re-`try_lock` and re-check `last_seen` immediately before `remove` to avoid dropping refreshed sessions; skip if the lock is busy and retry on the next sweep.
3) **Instrument cleanup:** Expose a histogram for GC duration and a counter/gauge for skipped entries due to lock contention; log janitor start/stop and capacity rejections.
4) **Proxy guardrails:** Document that the metrics listener must be firewalled or proxied; if run standalone, require binding to loopback via configuration default.
5) **Optional hardening:** Add jitter to the cleanup interval and bound the per-run removal batch to smooth work under churn.

These changes maintain determinism and minimalism while improving operational safety, shutdown hygiene, and observability without altering protocol behavior.

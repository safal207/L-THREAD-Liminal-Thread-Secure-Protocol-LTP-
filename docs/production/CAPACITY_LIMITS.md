# LTP Capacity, Backpressure and Resource Limits

## Scope

WP4 establishes a reproducible safe-operating-envelope test for the independent LTP reference runtime and all four native SDK process surfaces. It does not claim that one CI runner's numbers apply to every deployment.

Published numbers are valid only together with:

- exact source SHA and workflow run;
- CPU, logical core count, memory and operating system;
- Node, Python, Rust/Cargo and Elixir runtime versions;
- workload profile and duration;
- confirmation that signature, hash-chain, nonce and metadata-encryption verification stayed enabled.

## Default hard limits

The machine-readable source is `config/capacity/limits.json`.

| Limit | Default | Fail-closed behavior |
|---|---:|---|
| Inbound frame | 512 KiB | `FRAME_TOO_LARGE`, WebSocket close 1009 |
| Concurrent persisted sessions | 256 | handshake reject `session_capacity_limit` |
| Valid-window nonces per session | 4,096 | secure error `NONCE_CACHE_LIMIT` |
| Retained evidence records | 50,000 | bounded ring; dropped count exposed in snapshot |
| Pending outbound bytes | 1 MiB | `BACKPRESSURE_LIMIT`, close 1013 |
| Resumes per client/window | 8 / 10 s | handshake reject `reconnect_rate_limit` |
| Disconnected-session idle retention | 5 min | expired session and route removed |

Nonce eviction is time-aware. A nonce is removed only after its message timestamp is outside the server replay-validity window. The implementation never evicts a still-valid nonce merely to make room; it rejects new traffic with `NONCE_CACHE_LIMIT` instead.

## Backpressure contract

Outbound writes are admitted only when:

```text
socket.bufferedAmount + encodedFrameBytes <= maxPendingSendBytes
```

Crossing the boundary is explicit. The server records `BACKPRESSURE_LIMIT`, does not pretend the frame was sent and closes the connection with retryable overload status 1013. A deployment may choose lower limits, but may not turn the check into an unbounded queue.

## Workload profiles

### Pull request profile

- 8 concurrent authenticated sessions;
- 24 secured business frames per session;
- metadata encryption alternates on/off;
- one large encrypted payload in the configured measured range;
- reconnect storm and abuse boundaries;
- two measured native-process rounds per SDK after warmup.

### Protected-main and scheduled soak profile

- 32 concurrent authenticated sessions;
- 256 secured business frames per session;
- four measured native-process rounds per SDK after warmup;
- retained JSON, JSONL, Markdown and SVG evidence.

Every protected-main push that changes the WP4 surface runs this soak profile before exit evidence is recorded. The same profile also runs weekly and through manual workflow dispatch. It is a bounded CI soak, not a substitute for deployment-specific multi-hour or multi-day endurance testing.

## Metrics

The harness reports:

- P50, P95 and P99 secured round-trip latency;
- accepted frames, failure rate and throughput;
- process user/system CPU and maximum RSS for JavaScript, Python, Rust and Elixir;
- harness RSS samples and growth ceiling;
- active sessions, route entries, nonce entries and retained/dropped evidence;
- stable reason codes for oversized frame, session capacity, nonce capacity and reconnect rate.

SVG graphs are generated from the same raw JSONL samples retained in the workflow artifact.

## Security boundary

Benchmark traffic uses authenticated ECDH, session MAC signatures, hash-chain continuity, replay detection and server-response signature verification. Metadata encryption is explicitly exercised both enabled and disabled. Numbers produced with security verification bypassed are invalid and must not be published as WP4 evidence.

## Interpreting results

Capacity results are measured ranges, not universal promises. Before production deployment:

1. run the soak profile on hardware matching the deployment;
2. lower limits when the measured P99, RSS or failure-rate margin is insufficient;
3. repeat after runtime, crypto, dependency or protocol changes;
4. preserve the exact evidence artifact and source SHA;
5. do not promote a public RC or stable release while WP8 operational/SLO or WP9 audit gates remain open.

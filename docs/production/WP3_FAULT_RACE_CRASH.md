# LTP WP3 — Deterministic Fault, Reconnect Race and Crash/Restart Contract

**Status:** WP3 exit candidate for issue #502  
**Profiles:**

- `org.ltp.production.wp3.fault-race-crash.v0.1`
- `org.ltp.production.wp3.crash-restart-exit.v1`

## What the permanent gate proves

The CI gate proves that:

- the same seed produces the same ordered fault schedule and digest;
- a stale transport owner is rejected before receive-chain or replay-state commit;
- replay state survives authenticated owner replacement and process restart;
- same-session restoration preserves the exact committed receive/send chain;
- corrupt or mismatched persisted state fails closed into one explicit fresh session;
- trace and proxy artifacts contain digests, verdicts and reason codes, not payloads or key material;
- a live WebSocket fault proxy preserves text/binary opcode while injecting fragmentation, delay, duplicate and reorder faults;
- JavaScript, Python, Rust and Elixir complete SDK clients execute their authenticated 10-scenario catalog through the live fragmented proxy;
- JavaScript, Python, Rust and Elixir execute the same ownership/replay/reset invariant in separate runtime processes;
- a native JavaScript SDK process can be killed after server acknowledgement but before sender-side security-state commit;
- the actual reference-server process can be killed and restarted under a different PID from a checksummed same-session snapshot;
- a reused nonce remains rejected with `REPLAYED_NONCE` after the process restart;
- two authenticated reconnect attempts leave exactly one authoritative open socket;
- authenticated duplicate, delay and reorder timelines produce deterministic evidence.

The fault catalog covers drop-before/after-commit, delay, duplicate, reorder,
fragmentation, stale owner, reconnect competition, crash-before-persist,
server restart, corrupt snapshot and replay.

## Executable evidence

```bash
pnpm test:fault-injection
pnpm runtime:fault-matrix
pnpm native:fault-proxy-matrix
pnpm wp3:exit
pnpm fault:scenarios -- --seed wp3-ci-seed \
  --out artifacts/wp3-fault-evidence.json
```

The workflow publishes:

- `artifacts/wp3-fault-evidence.json` — deterministic schedule, state-machine trace and scenario verdicts;
- `artifacts/wp3-native-runtime-matrix.json` — JavaScript, Python, Rust and Elixir process outcomes;
- `artifacts/wp3-native-sdk-proxy.json` — 40 authenticated SDK scenarios through the live fragmented proxy;
- `artifacts/wp3-exit-evidence.json` — native `SIGKILL`, reference-server PID change and restore, replay rejection, reconnect election, corrupt reset, and duplicate/delay/reorder timeline digests.

The weekly scheduled workflow uses the extended deterministic schedule. A failed
seed must be retained as a regression fixture; rerunning until green is prohibited.

## Process restart contract

`tools/fault-injection/reference-server-process.ts` runs the real
`startReferenceServer` implementation in a child OS process. Its persisted snapshot
contains only continuity state:

- client, thread and session identity;
- protocol version and owner generation;
- committed receive/send hashes;
- the replay nonce set.

Session keys are not persisted. An authenticated resume derives fresh keys after
restart. The snapshot is bound to a profile, seed and SHA-256 checksum. Invalid
identity or checksum clears the imported sessions, preserves a monotonic ID floor,
and requires one explicit fresh authenticated handshake.

## Crash-after-send contract

`tools/fault-injection/native-crash-client.ts` uses the built JavaScript SDK. It
sends a correctly authenticated frame through the SDK transport while deliberately
not advancing `lastSentHash` and not invoking sender-side persistence. After the
server acknowledges the frame, the parent runner terminates the client with
`SIGKILL`, snapshots the server, terminates the server with `SIGKILL`, and starts a
new server process from that snapshot.

The recovered same-session client signs a new frame with the previously used nonce
and the correct committed chain predecessor. The restarted server rejects it as
`REPLAYED_NONCE`, proving that replay state—not merely old session keys—survived.

## Reconnect race contract

Two authenticated resume clients start concurrently against the restored session.
After both acknowledgements settle, the test requires exactly one WebSocket to
remain open. Only that owner may submit the next accepted frame. No retry loop,
random sleep or winner assumption is used.

## Authenticated network timelines

The exit artifact includes three digest-only timelines:

- **duplicate:** one accepted frame followed by `REPLAYED_NONCE`;
- **delay:** `DELAY` buffer evidence, explicit `DELAY_RELEASED`, then acceptance;
- **reorder:** the later chained frame reaches the server first and receives
  `BROKEN_HASH_CHAIN`, while the earlier frame is accepted after release.

## No-flake and redaction rules

The contract uses seeded schedules, explicit process messages and bounded event
polling rather than probabilistic wall-clock races. Instability is a product defect,
not a reason to add retries, `skip`, `xfail` or `continue-on-error`.

Published evidence is rejected if it contains raw frames, key-field names, the
reference secret, or private key material.

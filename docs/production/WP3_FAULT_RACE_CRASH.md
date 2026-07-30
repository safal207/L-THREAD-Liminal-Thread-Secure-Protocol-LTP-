# LTP WP3 — Deterministic Fault, Reconnect Race and Crash/Restart Contract

**Status:** executable WP3 foundation for issue #502  
**Profile:** `org.ltp.production.wp3.fault-race-crash.v0.1`

## What this proves

The permanent CI gate proves that:

- the same seed produces the same ordered fault schedule and digest;
- a stale transport owner is rejected before receive-chain or replay-state commit;
- replay state survives authenticated owner replacement and state restoration;
- same-session restoration preserves the exact committed receive/send chain;
- corrupt or mismatched persisted state fails closed into one explicit fresh session;
- trace and proxy artifacts contain digests, verdicts and reason codes, not payloads or key material;
- a live WebSocket fault proxy can fragment frames in front of the independent reference server without changing application semantics;
- replacement of a live connection makes the previous connection fail closed with `STALE_TRANSPORT_OWNER`;
- JavaScript, Python, Rust and Elixir execute the same ownership/replay/reset invariant in four separate runtime processes.

The fault catalog covers drop-before/after-commit, delay, duplicate, reorder,
fragmentation, stale owner, reconnect competition, crash-before-persist,
server restart, corrupt snapshot and replay.

## Executable evidence

```bash
pnpm test:fault-injection
pnpm runtime:fault-matrix
pnpm fault:scenarios -- --seed wp3-ci-seed \
  --out artifacts/wp3-fault-evidence.json
```

The workflow publishes:

- `artifacts/wp3-fault-evidence.json` — deterministic schedule, state-machine trace and scenario verdicts;
- `artifacts/wp3-native-runtime-matrix.json` — JavaScript, Python, Rust and Elixir process outcomes.

The weekly scheduled workflow uses the extended deterministic schedule. A failed
seed must be retained as a regression fixture; rerunning until green is prohibited.

## Live proxy boundary

`tools/fault-injection/proxy.ts` is a real WebSocket relay in front of the
independent reference server. It supports deterministic:

- drop before forward;
- forward then connection drop;
- delayed release;
- duplicate delivery;
- reorder buffering/release;
- WebSocket fragmentation;
- active-owner replacement and rejection of frames from an older connection.

Proxy evidence stores SHA-256 frame digests only. It does not store frame payloads
or secret material.

## Native runtime boundary

The four runtime adapters are separate Node.js, Python, Rust and Elixir processes.
They prove identical ownership, replay-after-restart and corrupt-state reset
outcomes. They are deliberately small conformance adapters rather than wrappers
around a single TypeScript implementation.

They do **not yet prove** that each complete production SDK executes every network
fault through the live proxy.

## Remaining work before closing #502

The issue remains open until the repository also contains:

1. JavaScript, Python, Rust and Elixir SDK adapters connected through the live fault proxy;
2. real client process termination after send and before persistence;
3. reference-server process restart with a persisted, checksummed same-session security snapshot;
4. simultaneous native reconnect attempts with one authoritative owner;
5. deterministic duplicate, delay and reorder scenarios using authenticated protocol frames;
6. final machine-readable race timeline and exact merge evidence.

For this reason `scope.live_proxy_wire_injection` in the lifecycle report remains
`false`: live proxy injection exists, but full four-SDK wire injection is not yet
proven.

## No-flake rule

The contract uses seeded schedules and explicit events rather than probabilistic
wall-clock races. Instability is a product defect, not a reason to add retries,
`skip`, `xfail` or `continue-on-error`.

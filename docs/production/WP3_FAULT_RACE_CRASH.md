# LTP WP3 — Deterministic Fault, Reconnect Race and Crash/Restart Contract

**Status:** executable first slice for issue #502  
**Profile:** `org.ltp.production.wp3.fault-race-crash.v0.1`

## What this proves

The permanent CI subset now proves that:

- the same seed produces the same ordered fault schedule;
- a stale transport owner is rejected before receive-chain or replay-state commit;
- replay state survives authenticated owner replacement and process-state restore;
- same-session restore preserves the exact committed receive/send chain;
- corrupt or mismatched persisted state fails closed into one explicit fresh session;
- trace artifacts contain hashes, verdicts and reason codes, not key material;
- JavaScript, Python, Rust and Elixir ownership profiles are evaluated against the same invariant contract.

The fault catalog covers drop-before/after-commit, delay, duplicate, reorder,
fragmentation, stale owner, reconnect competition, crash-before-persist,
server restart, corrupt snapshot and replay.

## Evidence

```bash
pnpm test:fault-injection
pnpm fault:scenarios -- --seed wp3-ci-seed \
  --out artifacts/wp3-fault-evidence.json
```

The JSON artifact is the source of truth. It includes:

- deterministic schedule and schedule digest;
- per-scenario verdict;
- state-machine trace;
- runtime ownership profile rows;
- explicit scope boundaries.

## Security boundary

This slice is a deterministic lifecycle/state-machine contract that shares the
reference-server security invariants and permanent CI boundary. It does **not yet
claim** that arbitrary TCP/WebSocket fragmentation is injected into every native
SDK process.

`scope.live_proxy_wire_injection` therefore remains `false`. Closing #502 still
requires the live seeded WebSocket proxy and native process crash/restart adapters.
This contract prevents those later adapters from weakening the invariants or
passing through flaky timing-based tests.

## No-flake rule

No random wall-clock sleeps are used. Scheduling is derived from SHA-256(seed,
counter), and all state transitions are synchronous and replayable. A failed seed
is a product defect and must be retained as a regression fixture.

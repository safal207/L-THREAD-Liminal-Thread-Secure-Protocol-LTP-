# LTP — Liminal Thread Protocol

LTP preserves orientation over time.
It does not predict, decide, or optimize outcomes.

**Fintech-Ready (Controlled Environments)**

LTP Node v0.1 provides audit-grade continuity, identity binding, and deterministic replay for regulated environments.
See [docs/fintech/Compliance-Inspection.md](docs/fintech/Compliance-Inspection.md) for details on compliance reports.

## Try it in 60 seconds

```bash
npm install -g @ltp/inspect
ltp inspect trace --input artifacts/traces/sample.trace.jsonl
```

If your shell cannot find the `ltp` command, restart the session or ensure the PNPM global bin directory is on your `PATH`.  
Prefer a workspace local run? Use: `pnpm -w ltp:inspect -- --input artifacts/traces/sample.trace.jsonl`.

No model. No agent framework. Just orientation, drift, and replay.

```text
Identity: stable (id=abc123)
Transitions: 5
Drift: +0.18 (accumulated)
Branches:
  - A (admissible)
  - B (admissible)
  - C (blocked: constraint)
Violations: none
Replay: deterministic
```

Repository content is sanitized to avoid hidden or bidirectional Unicode characters for supply-chain hygiene.

## Start here → Canonical Index

[Canonical LTP Index](canonical/README.md)

> Every pull request produces reproducible DevTools artifacts
> (Inspector output and golden traces) that make orientation,
> drift, and continuity auditable in CI.

These artifacts describe the control plane of AI systems —
coherence over time, not model outputs.

LTP is defined by a small set of orientation invariants. See: [docs/orientation-invariants.md](docs/orientation-invariants.md)

### DevTools & CI artifacts

LTP provides reproducible CI artifacts for inspecting orientation and drift
without running a model.

→ [docs/devtools/ci-artifacts.md](docs/devtools/ci-artifacts.md)

→ New here? Start with: docs/readme/WHY_ORIENTATION.md

**Deterministic routing protocol for context continuity, explainable transitions, and multi-path futures.**

LTP defines *how decisions, transitions, and agent handoffs are represented, verified, and replayed* — without black boxes, recommendations, or hidden state.

---

## Protocol Core Status

**Status:** Frozen  
**Since:** 2025-XX-XX

The LTP Protocol Core is considered **stable and frozen**.

This means:
- Core concepts, terms, and guarantees are fixed
- No semantic changes are allowed without an RFC
- Implementations may evolve, but must preserve core invariants

Further development happens through:
- RFC proposals
- Non-normative extensions
- Tooling, SDKs, and visualizations

Canonical reference:
- `docs/canonical/INDEX.md`

The canonical index defines the authoritative description of the LTP Core.

See also:
- [docs/glossary.md](docs/glossary.md)
- [docs/invariants.md](docs/invariants.md)

Glossary defines canonical terms; Invariants define non-negotiable protocol guarantees (MUST).

For boundaries and non-goals, rely on [docs/invariants.md](docs/invariants.md) and [docs/glossary.md](docs/glossary.md).

These documents define the canonical language of LTP.

---

## DevTools & Verification

LTP ships with built-in tooling for deterministic inspection and regression verification.

- 🔍 Inspector & CI artifacts — inspect orientation, drift, and admissible futures
- 🧪 Golden traces — canonical baselines for regression testing
- 🔁 One-click reproducibility — replay CI runs locally
  - One-click reproducibility = CI publishes the exact traces and inspector outputs needed to reproduce locally without model execution.

See:
- DevTools & CI artifacts: [docs/devtools/ci-artifacts.md](docs/devtools/ci-artifacts.md) — download artifacts → inspect → compare to golden traces

---

### Versioning & Stability

Track stability by surface:

- **Protocol:** `v0.1` — **Frozen Core**  
  Frames, Canonical Flow, Conformance, and Determinism rules are fixed and governed via RFC.

- **Tooling / SDKs:** `0.x` — **Rapid Iteration**  
  CLI, DevTools, SDKs, and integrations evolve independently of the protocol core.

> Think: stable protocol, fast tooling.

---

### What LTP is (and is not)

**LTP is:**
- A protocol for deterministic decision routing
- A standard you can verify, audit, and replay
- A neutral layer for continuity across systems and agents

**LTP is not:**
- ❌ A recommendation system  
- ❌ A machine learning model  
- ❌ A black-box intelligence layer

## Production hardening checklist (Rust node)

Harden a Rust node with these defaults:

- Terminate TLS at a reverse proxy (Caddy/Nginx/Traefik); forward WebSocket upgrades to the node.
- Enable API-key auth with `AUTH_MODE=api_key` and supply keys via `AUTH_KEYS_FILE` (JSON object) or `AUTH_KEYS` fallback.
- Rotate keys without restart via `AUTH_KEYS_RELOAD_INTERVAL_SECS` (default 30s).
- Enforce limits:
  - Per-connection: `RATE_LIMIT_RPS`, `RATE_LIMIT_BURST`
  - Per-IP: `IP_RATE_LIMIT_RPS`, `IP_RATE_LIMIT_BURST`, `IP_RATE_LIMIT_TTL_SECS`
  - Message size: `MAX_MESSAGE_BYTES` (default 64KiB)
- Keep idle sessions bounded: `LTP_NODE_IDLE_TTL_MS`, `LTP_NODE_GC_INTERVAL_MS`
- Trust proxy headers only when safe: set `TRUST_PROXY=true` only behind a trusted proxy that sets `X-Forwarded-For`.
- **(Fintech P1)** Set `LTP_ALLOW_PROXY_CIDR` if using `TRUST_PROXY=true`.
- Scrape `/metrics` for flood/auth observability (`auth_keys_*`, `rate_limit_*`, `oversize_messages_total`, `log_suppressed_total`).

---

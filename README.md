# LTP — Liminal Thread Protocol

[![Protocol](https://img.shields.io/badge/protocol-v0.1-0A7?style=flat-square)](specs/LTP-Spec-v0.1.md)
[![Conformance](https://img.shields.io/badge/conformance-report%20schema-v0.1-blue?style=flat-square)](schemas/ltp-conformance-report.v0.1.json)
[![Security](https://img.shields.io/badge/security-signed%20traces-informational?style=flat-square)](docs/security/Signed-Traces.md)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

LTP preserves orientation over time.
It does not predict, decide, or optimize outcomes.

**LTP is an open protocol for verifiable AI-agent continuity, deterministic replay, and auditable handoffs in regulated systems.**


## Why developers pick LTP

- **Trustworthy by design:** protocol-level continuity and replay, not framework-specific magic.
- **Fast incident analysis:** reconstruct transition history from traces, without model re-runs.
- **Compliance-friendly:** deterministic evidence for audits, controls, and critical action reviews.
- **Works with your stack:** adapters, examples, and conformance tooling for progressive adoption.

## Choose your entry point

| If you are... | Start here |
|---|---|
| Evaluating the protocol in 10 minutes | [specs/README.md](specs/README.md) |
| Integrating in CI / DevTools | [docs/devtools/quickstart.md](docs/devtools/quickstart.md) |
| Building agent workflows | [adapters/README.md](adapters/README.md) |
| Preparing compliance evidence | [docs/operational-notes/conformance.md](docs/operational-notes/conformance.md) |
| Exploring end-to-end examples | [examples/README.canonical-flow.md](examples/README.canonical-flow.md) |

## 30-second pitch (for teams and stakeholders)

LTP is the **protocol layer for AI continuity**: it makes agent transitions reproducible, auditable, and policy-checkable without depending on one model vendor or one agent framework.

If your system ever needs to answer:
- *"Why did the agent do this?"*
- *"Can we replay this exact path?"*
- *"Can we prove policy compliance to auditors or security?"*

LTP gives you a deterministic, inspectable trail.

## What this gives you (practically)

- **Deterministic replay:** investigate any transition path without model re-execution.
- **Auditable handoffs:** preserve identity, constraints, and continuity across agent/system boundaries.
- **Policy enforcement by trace:** verify critical actions from signed, inspectable protocol events.

## Proof points you can verify in this repo

- **Formal spec surface:** [specs/LTP-Spec-v0.1.md](specs/LTP-Spec-v0.1.md)
- **Conformance fixtures:** [fixtures/conformance/v0.1](fixtures/conformance/v0.1)
- **Cross-SDK compatibility checks:** [tests/cross-sdk/README.md](tests/cross-sdk/README.md)
- **Security hardening guidance:** [SECURITY_HARDENING.md](SECURITY_HARDENING.md)
- **Release/change history:** [CHANGELOG.md](CHANGELOG.md)

## Why LTP instead of "just logs" or framework tracing

| Approach | Good for | Typical gap | What LTP adds |
|---|---|---|---|
| App logs | Runtime debugging | Weak continuity semantics across agent handoffs | Protocol-native orientation and deterministic replay |
| Framework-specific traces | Single-stack observability | Vendor/framework lock-in and inconsistent handoff semantics | Neutral protocol surface across stacks |
| Prompt/version snapshots | Artifact retention | Hard to verify transition admissibility over time | Verifiable transitions with conformance-oriented structure |

## High-impact use-case packs

- **Agent safety boundaries:** [examples/agent-boundary](examples/agent-boundary)
- **Fintech continuity patterns:** [examples/fintech/README.md](examples/fintech/README.md)
- **Infrastructure observability:** [examples/infra-observer/README.md](examples/infra-observer/README.md)
- **Protocol conformance scenarios:** [examples/scenarios](examples/scenarios)

## Start in 5 minutes

1. Read the protocol north star: [WHITEPAPER.md](WHITEPAPER.md)
2. Open the canonical protocol surface: [specs/LTP-Spec-v0.1.md](specs/LTP-Spec-v0.1.md)
3. Validate a sample trace locally: [Try it in 60 seconds](#try-it-in-60-seconds)
4. Choose your integration path:
   - **Agents:** [docs/quickstart/agents.md](docs/quickstart/agents.md)
   - **Fintech / compliance:** [docs/quickstart/fintech.md](docs/quickstart/fintech.md)
   - **DevTools / CI:** [docs/quickstart/devtools.md](docs/quickstart/devtools.md)

## Who should use LTP

- Teams building AI agents that must remain explainable over long-running sessions.
- Regulated products requiring deterministic replay and compliance evidence.
- Platform teams standardizing multi-agent routing and safe tool/action boundaries.

For maintainers: GitHub visibility execution checklist → [docs/GITHUB_DISCOVERABILITY_CHECKLIST.md](docs/GITHUB_DISCOVERABILITY_CHECKLIST.md)

## Quick next actions

1. Run a demo: `pnpm -w demo:canonical`
2. Validate traces in your pipeline: `pnpm -w ltp:verify`
3. Share the one-pager with product/security stakeholders: [docs/positioning/ONE_PAGER.md](docs/positioning/ONE_PAGER.md)
4. Run the newcomer launch sequence (PLF/LOT): [docs/marketing/PLF-LOT-NEWCOMER-SEQUENCE.md](docs/marketing/PLF-LOT-NEWCOMER-SEQUENCE.md)

> **Share internally:** "LTP is a vendor-neutral protocol for auditable AI continuity. We can replay decisions deterministically and prove handoff-policy compliance from trace evidence."  
> One-pager: [docs/positioning/ONE_PAGER.md](docs/positioning/ONE_PAGER.md)

**Fintech-Ready (Controlled Environments)**

LTP Node v0.1 provides audit-grade continuity, identity binding, and deterministic replay for regulated environments.
See [docs/fintech/Compliance-Inspection.md](docs/fintech/Compliance-Inspection.md) for details on compliance reports.

## Try it in 60 seconds

```bash
npm install -g @ltp/inspect
ltp inspect trace --input artifacts/traces/sample.trace.jsonl
```

If your shell cannot find the `ltp` command, restart the session or ensure the PNPM global bin directory is on your `PATH`.  
Prefer a workspace local run? Use: `pnpm -w ltp:inspect -- trace --input artifacts/traces/sample.trace.jsonl`.


## Adoption menu (pick your depth)

- **Pilot (1 day):** run canonical/demo flows and inspect traces locally.
- **Team rollout (1–2 weeks):** integrate conformance checks in CI and standardize handoff events.
- **Regulated path (ongoing):** produce deterministic evidence streams for controls and audits.

Start with [docs/positioning/ONE_PAGER.md](docs/positioning/ONE_PAGER.md) for stakeholder alignment.

## Popular demos

- Canonical flow walkthrough: `pnpm -w demo:canonical`
- Story/multipath visualization: `pnpm -w demo:future-weave`
- Conformance self-test demo: `pnpm -w demo:conformance:self-test`

See additional runnable scenarios in [examples/scenarios](examples/scenarios).

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

## Start here → Project Index

[Project Index](canonical/README.md)

Canon → [docs/canon/README.md](docs/canon/README.md)  
Canon version → [docs/contracts/CANON_VERSION.md](docs/contracts/CANON_VERSION.md)  
Requirements → [docs/contracts/REQUIREMENTS.md](docs/contracts/REQUIREMENTS.md)

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

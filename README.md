# LTP — Liminal Thread Protocol

[![Protocol](https://img.shields.io/badge/protocol-v0.1-0A7?style=flat-square)](specs/LTP-Spec-v0.1.md)
[![Conformance](https://img.shields.io/badge/conformance-report%20schema-v0.1-blue?style=flat-square)](schemas/ltp-conformance-report.v0.1.json)
[![Security](https://img.shields.io/badge/security-signed%20traces-informational?style=flat-square)](docs/security/Signed-Traces.md)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

LTP preserves orientation over time.
It does not predict, decide, or optimize outcomes.

**LTP is an open protocol for verifiable AI-agent continuity, deterministic replay, and auditable handoffs in regulated systems.**

## Hero demo (drop-in slot)

> Add a 5–8s GIF/screencast here showing: `ltp inspect` → replay statuses (safe / drifted / blocked).
>
> Suggested caption: **"See your AI agent transition path in seconds — safe, drifted, blocked."**


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
- **Reasoning State Graph:** model agent decision states as navigable transitions for inspection and replay.
- **Automatic rewind mechanism:** self-correct reasoning paths when contradictions, low confidence, or failure feedback appears.

## Reasoning State Graph

The Reasoning State Graph module models agent reasoning as a stateful graph instead of a single linear chain.
It captures transitions across stages like `start`, `plan`, `execution`, `evaluation`, and `feedback`, making reasoning paths inspectable and debuggable.

Each transition stores operational metadata, including:

- confidence score
- execution status
- environmental feedback

> The Reasoning State Graph turns the agent's reasoning process into a navigable structure.
> Instead of a linear chain of thoughts, the system maintains a graph of reasoning states that can be inspected, replayed, and rewound when contradictions appear.

### Rewind Mechanism

The rewind mechanism automatically backtracks reasoning when a failure signal is detected.

Triggers for rewind:

1. Low confidence threshold
2. Execution contradiction
3. External feedback indicating failure

Example:

```text
start
  ↓
plan A
  ↓
execute plan A
confidence = 0.68
threshold = 0.7

Result:

execute plan A
      ↓
    REWIND
      ↓
    plan A
```

This allows the agent to reconsider prior reasoning steps before committing downstream actions.

## LTP Reasoning Architecture

The Reasoning State Graph integrates with the broader LTP stack as a reasoning control layer:

1. Message Protocol
2. Semantic Inspector
3. Trace Replay
4. Reasoning State Graph

In this architecture, Trace Replay and the Reasoning State Graph work together: replay reconstructs what happened, while the state graph explains why reasoning shifted, failed, or rewound.

```text
start
  │
  ▼
plan
  │
  ▼
execute
  │
  ├── success → finish
  │
  └── contradiction
        │
        ▼
      rewind
        │
        ▼
       plan
```

### Debugging Hallucinations

Developers can use the state graph to inspect reasoning failures and identify hallucination points.

Example flow:

`plan → execute → contradiction → rewind → alternative plan`

This makes it possible to:

- identify hallucination points
- inspect reasoning confidence
- replay reasoning traces

### Developer Usage Example

```ts
const stateGraph = new ReasoningStateGraph()

stateGraph.transition("start", "planA", { confidence: 0.92 })
stateGraph.transition("planA", "execute", { confidence: 0.88 })

stateGraph.feedback("execute", "execution_blocked")

stateGraph.rewind()
```

This pattern enables automatic backtracking of reasoning paths when runtime signals indicate that the current trajectory is unreliable.

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

## LTP vs alternatives

| Feature | Traditional Logs | Framework Tracing | LTP Inspect |
|---|---|---|---|
| Deterministic replay | No | Partial | Yes |
| Protocol-level provenance | No | No | Yes |
| Early block on fake anchor patterns | No | No | Yes |
| Final block on novel fact injection | No | Partial | Yes |
| Model/framework agnostic | Partial | No | Yes |
| Regulated audit-ready traces | No | Partial | Yes |

## High-impact use-case packs

- **Agent safety boundaries:** [examples/agent-boundary](examples/agent-boundary)
- **Fintech continuity patterns:** [examples/fintech/README.md](examples/fintech/README.md)
- **Infrastructure observability:** [examples/infra-observer/README.md](examples/infra-observer/README.md)
- **Protocol conformance scenarios:** [examples/scenarios](examples/scenarios)

## Proof in 60 seconds

```bash
git clone https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-.git
cd L-THREAD-Liminal-Thread-Secure-Protocol-LTP-
pnpm install
pnpm build
pnpm -w demo:canonical
```

Then verify conformance output:

```bash
pnpm -w ltp:verify
```

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
4. Run the newcomer launch sequence (PLF/LTP): [docs/marketing/PLF-LTP-NEWCOMER-SEQUENCE.md](docs/marketing/PLF-LTP-NEWCOMER-SEQUENCE.md)
5. Generate ready-to-send PLF assets: `npm run -s marketing:plf:generate -- --project "LTP Pilot" --owner "Platform Team"`

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


## Who wins most with LTP

- **Fintech compliance teams:** block fabricated transaction claims before audit evidence is finalized.
- **OSINT / threat intelligence teams:** prevent unanchored links from entering operational graphs.
- **Legal AI teams:** reject novel clauses that are not grounded in prior approved evidence.
- **Infra/platform teams:** preserve deterministic continuity across degraded or failing subsystems.

## Adoption menu (pick your depth)

- **Pilot (1 day):** run canonical/demo flows and inspect traces locally.
- **Team rollout (1–2 weeks):** integrate conformance checks in CI and standardize handoff events.
- **Regulated path (ongoing):** produce deterministic evidence streams for controls and audits.

Start with [docs/positioning/ONE_PAGER.md](docs/positioning/ONE_PAGER.md) for stakeholder alignment.

## Onboard your team fast (PLF kit)

Want a ready-to-run newcomer onboarding campaign?

- Playbook: [docs/marketing/PLF-LTP-NEWCOMER-SEQUENCE.md](docs/marketing/PLF-LTP-NEWCOMER-SEQUENCE.md)
- Runnable kit: [docs/marketing/plf-kit/README.md](docs/marketing/plf-kit/README.md)
- Generator command:

```bash
npm run -s marketing:plf:generate -- --project "LTP Pilot" --owner "Platform Team"
```

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

## Community & adoption

- Discuss implementation patterns in Issues: <https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-/issues>
- Share your use-case and artifacts with a "showcase" issue.
- Need an adapter for your stack? Open an issue with your runtime + constraints.

## DevTools & Verification

LTP ships with built-in tooling for deterministic inspection and regression verification.

- 🔍 Inspector & CI artifacts — inspect orientation, drift, and admissible futures
- 🧪 Golden traces — canonical baselines for regression testing
- 🔁 One-click reproducibility — replay CI runs locally
  - One-click reproducibility = CI publishes the exact traces and inspector outputs needed to reproduce locally without model execution.

See:
- DevTools & CI artifacts: [docs/devtools/ci-artifacts.md](docs/devtools/ci-artifacts.md) — download artifacts → inspect → compare to golden traces

---

## Roadmap snapshot

**Near-term (v1.2–v1.3)**
- LangChain / CrewAI integration examples
- Web-based trace visualizer
- Automated CI continuity badge

**Longer-term**
- Distributed thread registry
- Multi-node continuity enforcement

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

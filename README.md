# LTP — Liminal Thread Protocol

Deterministic replay + hallucination blocking for agent traces, with audit-ready evidence.

![LTP replay demo preview](assets/replay-demo.svg)

<!-- community-interest:start -->
### 🌟 Community Interest

![Stars](https://img.shields.io/github/stars/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-?style=for-the-badge)

> Current interest: 1 stars → 🌱 New signal 🚀  
> Want to join? [Click here](https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-/stargazers) to show support!
<!-- community-interest:end -->

```bash
ltp inspect trace tools/ltp-inspect/fixtures/replay/trace-replay.jsonl --replay --phase two_phase --color
```

## What you get

- Phase 1 + Phase 2 guardrails for hallucination prevention/detection.
- Deterministic trace replay with `admissible / drift / rejected` decisions.
- Model-agnostic adapter surface (GPT, Claude, LLaMA, Grok, and future stacks).
- Compliance evidence via JSONL traces + generated logs.

## Live demo (GitHub Actions)

[![Run LTP Demo](https://img.shields.io/badge/Live%20Demo-Run%20Workflow-blue?style=for-the-badge)](.github/workflows/demo.yml)

Run `LTP Live Demo` via **workflow_dispatch** to produce:

- `replay.log`
- `replay.gif`

## LTP vs ordinary logging

| Capability | Regular app logs | Framework tracing | LTP |
|---|---|---|---|
| Deterministic replay | ❌ | ⚠️ | ✅ |
| Hallucination gating (pre + post) | ❌ | ❌ | ✅ |
| Audit evidence format | ⚠️ | ⚠️ | ✅ |
| Model/framework agnostic | ✅ | ❌ | ✅ |

## Use-case cards

<details>
<summary>💳 Fintech</summary>

- KYC/AML assistant actions with anchored policy checks.
- Transfer and approvals with immediate reject on unanchored claims.
</details>

<details>
<summary>🕵️ OSINT</summary>

- Evidence graph summaries blocked when source anchors are missing.
- Replay divergence analysis for investigative chain-of-custody.
</details>

<details>
<summary>⚖️ Legal</summary>

- Contract/policy citation enforcement.
- Post-hoc rejection of unsupported conclusions.
</details>

<details>
<summary>🛠️ Infra / SRE</summary>

- Incident-agent replay to inspect drift before automated actions.
- Critical runbook actions gated by anchor-backed context.
</details>

## Quick links

- DevTools: `docs/devtools/quickstart.md`
- Compliance: `docs/fintech/Compliance-Inspection.md`
- Adapters: `adapters/README.md`
- Example flow: `examples/README.canonical-flow.md`
- Spec: `specs/LTP-Spec-v0.1.md`

## Roadmap

- ✅ Replay analyzer (`ltp inspect trace`)
- ✅ Two-phase enforcement
- ✅ GitHub Actions interactive demo
- 🟡 Expanded adapter SDKs
- 🟡 Rich replay animation renderer
- 🔴 AutoGen v1.2 reference adapter

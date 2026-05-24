# LTP - Liminal Thread Protocol

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Traceability](https://img.shields.io/badge/traceability-deterministic-blue)
![License](https://img.shields.io/badge/license-MIT-orange)

LTP is a deterministic oversight and replay protocol for agent traces.
It helps teams inspect whether an AI or agent followed an admissible, grounded execution path, detect drift, reject unsupported outputs or actions, and preserve audit-grade evidence for high-risk workflows.

For reviewers navigating the broader ecosystem: LTP is the trace/replay/continuity layer in a broader trustworthy-agent evidence architecture. See the [Ecosystem Spider Map](docs/ECOSYSTEM_SPIDER_MAP.md), the [LS Grant Reviewer Packet 2026](https://github.com/safal207/LS/blob/main/docs/GRANT_REVIEWER_PACKET_2026.md), and the [ProofPath ecosystem graph](https://github.com/safal207/ProofPath/blob/main/docs/ECOSYSTEM_GRAPH.md).

![LTP replay demo preview](assets/replay-demo.svg)

<!-- community-interest:start -->
### 🌟 Community Interest

![Stars](https://img.shields.io/github/stars/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-?style=for-the-badge)

> Current interest: 3 stars → 🌱 New signal 🚀  
> Want to join? [Click here](https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-/stargazers) to show support!
<!-- community-interest:end -->

**Project status:** Active protocol and SDK development with multi-language CI checks.

**Fast validation (under 2 minutes):**

```bash
pnpm install --frozen-lockfile
pnpm test
```

## For grant reviewers

If you are evaluating LTP for a $20k-$50k AI safety / open-source infrastructure seed grant, start with:

- Ecosystem spider map: `docs/ECOSYSTEM_SPIDER_MAP.md`
- Reviewer path: `docs/GRANT_REVIEWER_PATH.md`
- Seed grant proposal: `docs/GRANT_PROPOSAL_20K_50K.md`
- Benchmark plan: `docs/BENCHMARK_PLAN.md`
- Evaluation protocol: `docs/EVALUATION_PROTOCOL.md`
- Showcase trace map: `docs/SHOWCASE_TRACES.md`
- Repository map: `docs/REPO_MAP.md`
- Documentation status: `docs/DOCS_STATUS.md`
- Existing evidence and non-claims: `docs/GRANT_EVIDENCE.md`
- Grant brief: `GRANT_BRIEF.md`

## Why LTP exists

Modern agent systems can produce outputs that look plausible while following unsupported, drifting, or unauditable execution paths.
LTP exists to make those paths inspectable, replayable, and rejectable, with evidence that can be reviewed by operators, auditors, and compliance teams.

LTP is not a general-purpose runtime orchestrator. In v0.1, its practical identity is deterministic replay, execution-path inspection, admissibility judgment, and evidence export.

## Architecture at a glance

```mermaid
flowchart LR
  A["Agent / Runtime"] -->|"emits events"| B["LTP Trace JSONL"]
  B --> C["Replay Engine"]
  B --> D["Two-Phase Inspector"]
  C --> E["Replay Result"]
  D --> F["Admissibility Decision"]
  F -->|"admissible"| G["Proceed / Accept"]
  F -->|"drift"| H["Review / Audit"]
  F -->|"rejected"| I["Block / Reject"]
  E --> J["Conformance Report"]
  F --> J
  J --> K["Audit Evidence Bundle"]
  B --> L["SDKs and Adapters"]
  L --> M["LangGraph / AutoGen / CrewAI / Custom Agents"]
  J --> N["Commercial Audit / Hosted Conformance / Pilot Review"]
```

More detail: `docs/architecture/LTP-Architecture.md`

## What you get

- Deterministic replay-based inspection for agent execution traces.
- Oversight decisions on execution paths: `admissible / drift / rejected`.
- Two-phase oversight checks (pre-action/pre-generation and post-generation/post-action).
- Unsupported-path rejection within the oversight profile, including ungrounded or hallucinated claims.
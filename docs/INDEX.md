# LTP Documentation Index

This repository defines **LTP (Liminal Thread Protocol)** — a continuity layer that preserves orientation across time.

## Quickstart (By Market)

- **[Developers](./quickstart/devtools.md)**: Inspect and validate traces locally.
- **[Fintech](./quickstart/fintech.md)**: Compliance and audit logging.
- **[AI Agents](./quickstart/agents.md)**: Safety boundaries and critical actions.

## Start here

- **Canon (read first)**
  - **[LTP vs Blockchain/Crypto Agents](./vision/LTP-vs-Blockchain-Crypto-Agents.md)** (Market Positioning)
  - **[Limits of LTP](./guardrails/LTP-Limits-of-LTP.md)**
  - **[Non-Goals as Design Constraints](./guardrails/LTP-Non-Goals-as-Design-Constraints.md)**
  - **[Build Products on LTP Without Violating the Core](./guardrails/How-to-Build-Products-on-LTP-Without-Violating-the-Core.md)**
  - **[Critical Actions Standard](./guardrails/LTP-Critical-Actions-v0.1.md)**
- **Core references**
  - **[Invariants](./invariants.md)**
  - **[Glossary](./glossary.md)**
  - **[Security Posture](./security/posture.md)** (New)
  - **[Compatibility Matrix](./compat/matrix.md)** (New)
- **Specs**
  - **[LTP Conformance v0.1](../specs/LTP-Conformance-v0.1.md)**

## Market-Specific Documentation

### Market E: Infrastructure & Continuity
- **[Continuity Router Architecture](./markets/infrastructure/LTP-Continuity-Router.md)**
- **[WebSocket Outage Scenario](./markets/infrastructure/WebSocket-Outage-Scenario.md)**
- **[Continuity Flow](./markets/infrastructure/Continuity-Router-Flow.md)**
- **[Failure Recovery Semantics](./markets/infrastructure/Failure-Recovery-Semantics.md)**

## One sentence

LTP does not decide outcomes. It validates **admissible transitions** to preserve continuity over time.

## Rule of thumb

If your system asks:

- “What should we do?” → not LTP
- “How do we do it?” → not LTP
- “Are we still the same system over time?” → LTP

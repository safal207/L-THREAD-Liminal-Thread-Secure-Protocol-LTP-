# LTP Adoption & Certification Levels v0.1

## Purpose

This document defines incremental adoption and certification levels for the Liminal Thread Protocol (LTP).

LTP is designed to be adopted gradually, across heterogeneous systems, teams, and maturity levels.
Implementations are not required to support the full protocol surface to be valid participants in the LTP ecosystem.

Partial conformance is explicit, respected, and encouraged.

---

## Adoption Philosophy

LTP follows three core principles:

1. **Incremental adoption**
Systems may adopt LTP in stages without architectural rewrites.

2. **Explicit capability declaration**
Every implementation declares what level it supports.

3. **Behavior over ideology**
LTP does not mandate storage, ML, LLMs, or specific transports.

LTP is a protocol of coordination, not a framework or platform.

---

## Certification Levels

### 🟢 LTP-Core

The minimal level of participation in the LTP ecosystem.

**Requirements**

An implementation MUST:

- Accept and emit all required frames defined in LTP-Frames-v0.1
- Respect Flow Requirements from LTP-Conformance-v0.1
- Preserve frame ordering per session
- Ignore unknown frame types (forward-compatible behavior)
- Avoid crashes or undefined behavior under malformed input

**Intended for**

- Clients
- SDKs
- HUDs
- Edge agents

**Meaning**

> “This system speaks LTP.”

---

### 🔵 LTP-Flow

Behavioral compliance with LTP routing and transition semantics.

**Additional Requirements**

An implementation MUST:

- Implement Canonical Flow semantics
- Return multiple plausible branches for routing decisions
- Degrade gracefully under load (reduced depth or branching is acceptable)
- Provide basic explainability signals for routing outcomes

**Intended for**

- Routing engines
- Node gateways
- AI orchestration layers
- Decision-support services

**Meaning**

> “This system behaves according to LTP.”

---

### 🟣 LTP-Canonical

Trust-grade compliance for critical and regulated environments.

**Additional Requirements**

An implementation MUST:

- Demonstrate deterministic behavior within tolerance
- Expose a self-test or diagnostic flow validating Canonical Flow compliance
- Provide traceable factors for routing and orientation decisions

**Intended for**

- Enterprise systems
- Regulated domains
- Infrastructure-level deployments

**Meaning**

> “This system can be trusted as LTP infrastructure.”

---

## Declaration Examples

Implementations MAY publicly declare conformance using the following phrases:

- “This implementation is LTP-Core conformant (v0.1).”
- “This service operates at LTP-Flow level.”
- “This node is LTP-Canonical compliant.”

Declarations MUST match actual supported behavior.

---

## Non-Exclusivity Principle

LTP:

- Does not replace HTTP, REST, WebSocket, or message queues
- Does not require ML, LLMs, or statistical models
- Does not mandate persistence or global state

LTP operates alongside existing systems, providing a semantic coordination layer.

---

## Future Levels (Reserved)

The following levels are intentionally reserved for future specification:

- **LTP-Collective** — multi-agent and group-level coordination
- **LTP-Autonomous** — self-regulating protocol behavior
- **LTP-Inter-Protocol** — coordination across heterogeneous protocols

No guarantees or timelines are implied.

---

## Stability Commitment

Once published, certification level semantics MUST NOT be broken.
Future versions MAY extend requirements but MUST preserve backward compatibility.

---

## Closing Statement

LTP adoption is a spectrum, not a gate.

Systems are encouraged to participate at the level that fits their purpose, constraints, and risk tolerance — while remaining interoperable within the broader LTP ecosystem.

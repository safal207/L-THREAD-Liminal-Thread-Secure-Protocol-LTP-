# LTP-RFC-0001: Motivation, Scope, and Non-Goals

## Status
Draft

## Abstract
Liminal Thread Protocol (LTP) defines transport-agnostic semantics for frame-based communication that preserve orientation, routing intent, and state continuity for humans and autonomous agents. It specifies how participants describe flows, resolve branches, and maintain explainable decisions independent of underlying network or storage layers. LTP is not an application framework or platform; it is a protocol surface for interoperable orchestration and reasoning. The RFC establishes motivations, scope boundaries, and guiding constraints for future specifications.

## Motivation
Existing interaction models rely on stateless request-response patterns, opaque event buses, or framework-specific agent tooling that tightly couple logic to implementation details. These systems obscure why routes are chosen, centralize decision authority, and degrade when flows branch or pause. LTP is proposed to standardize orientation-aware communication so that threads can move between participants, transports, or runtimes without losing context. By defining routing semantics and explainable state transitions at the protocol layer, LTP aims to provide predictable behavior across heterogeneous environments and reduce accidental complexity.

## Problem Statement
- Stateless exchanges misalign with long-running human and agent conversations, causing context loss and brittle retries.
- Centralized routers or orchestrators concentrate decision power and create single points of failure or policy enforcement.
- Opaque routing and inference steps prevent auditability and post-hoc explanation of outcomes.
- Workflow orchestration often depends on vendor-specific primitives that cannot survive transport changes or partial failures.

## Design Philosophy
- Minimal core: favor a small, rigorous set of primitives over expansive feature sets.
- Deterministic behavior: identical inputs and prior state yield identical routing decisions.
- Explainability over optimization: every transition should be reconstructible and human-auditable.
- Transport and storage agnostic: semantics hold across HTTP, message queues, peer-to-peer links, or offline buffers.
- Graceful degradation: partial availability should not corrupt state; participants should continue with reduced capability when necessary.
- Silence is a signal: absence of frames or acknowledgments carries meaning and must be representable.

## Scope
- Frame-based communication model with explicit orientation metadata.
- Routing semantics for branching, merging, and continuation of threads across participants.
- Canonical flow definitions that describe expected states, transitions, and required evidence.
- Conformance testing guidelines to ensure interoperable implementations across languages and transports.

## Non-Goals
- LTP is not an AI model or reasoning engine.
- LTP is not an LLM wrapper or prompt management layer.
- LTP is not a recommendation system or decision oracle.
- LTP is not a database, data lake, or storage abstraction.
- LTP is not a blockchain or distributed ledger.
- LTP does not replace TCP, HTTP, or other transport protocols.
- LTP is not a user experience or UI framework.

## Relationship to Existing Systems
LTP complements REST by providing stateful, explainable routing semantics absent in stateless APIs. It aligns with event-driven systems by defining orientation and traceability rather than competing with messaging substrates. Agent frameworks can use LTP to standardize exchange semantics without dictating cognition models. Workflow engines may emit or consume LTP frames to gain portability and auditability while retaining their execution logic.

## Design Constraints
- Backward compatibility for future revisions to minimize breakage of deployed flows.
- Human interpretability so operators can reason about thread state without specialized tooling.
- Multi-language parity to avoid privileging specific runtimes or SDKs.
- Low cognitive overhead: concepts and artifacts must remain concise and composable.
- Offline-capable reasoning: frames and routing decisions should survive disconnection and reconcile when links restore.

## Security & Ethics Notes
- Explainability is a safety feature; participants must be able to justify routing and state transitions.
- Avoid opaque decision-making: protocol artifacts should expose enough evidence for audit and dispute resolution.
- No forced behavior: LTP defines communication semantics, not compulsory actions or overrides of local policy.
- Human-in-the-loop alignment: the protocol must allow inspection, intervention, and overrides without breaking flows.

## Future Work
- Establishment of a governance process for maintaining and evolving RFCs.
- Additional RFCs detailing canonical flow structures, frame semantics, and conformance criteria.
- Formal definition of conformance levels and negotiated capabilities between participants.
- Reference implementations and test suites across multiple languages and transports.

## References
- RFC 2119: Key words for use in RFCs to Indicate Requirement Levels.
- W3C Process Document for standardization workflows.
- Existing messaging and workflow standards (AMQP, HTTP, BPMN) for interoperability considerations.

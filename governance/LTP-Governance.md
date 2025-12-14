# LTP Governance (v0.1)

Liminal Thread Protocol (LTP) governance establishes a stable core, additive evolution, and neutral stewardship so that nodes, SDKs, and operators can rely on the protocol for decades. LTP evolves through agreement, not control.

## Scope
- Applies to all protocol artifacts (Frames, Flow, Conformance, SDKs, reference nodes).
- Binds governance for v0.x and v1.x lines; future revisions MUST extend rather than replace these constraints.

## Principles
- **Minimal Core — frozen.** The canonical frame surface (v0.1) is locked and only updated via RFC-Core with rough consensus and compelling interoperability evidence.
- **Additive Evolution — only addition.** Changes favor backward-compatible extensions and optional capabilities; removals are prohibited from the protocol surface.
- **Implementation Independence.** No single runtime, cloud, or vendor dictates conformance; any compliant implementation can participate.
- **Explainability over Intelligence.** Protocol state is observable and reasoned about; opaque or probabilistic behaviors are discouraged in the core.
- **Governance over Authority.** Decisions are documented, consensus-driven, and appealable through the RFC process rather than centralized mandates.

## Non-Authority Principle
This specification does not grant authority to any single organization, node, or vendor. Governance processes are intended to coordinate evolution, not to control implementations.

## Governance Bodies
- **Contributors & Implementers:** propose RFCs, run conformance kits, and operate nodes.
- **Maintainers:** curate repos, apply RFC decisions, and guard protocol invariants.
- **Advisory Board:** issues non-binding guidance, reviews alignment with neutrality, and provides annual retrospectives.

## Process Coupling
- Protocol changes follow [`governance/rfcs/PROCESS.md`](./rfcs/PROCESS.md) with explicit compatibility and conformance impact statements.
- Version policy is tracked in [`governance/LTP-Versioning.md`](./LTP-Versioning.md) to ensure market stability.
- Neutrality guarantees are codified in [`governance/LTP-Neutrality.md`](./LTP-Neutrality.md) and apply to any hosted service or product claiming LTP compatibility.

## Enforcement
- Conformance kits and public fixtures are the first line of governance enforcement.
- Decisions are logged per [`governance/adr/PROCESS.md`](./adr/PROCESS.md); silence is a signal, but documented dissent is preserved.
- Forks are permitted when necessary; fragmentation is discouraged via compatibility profiles and shared fixtures.

## Commitments
- The protocol surface remains predictable: additive, explainable, and implementation-neutral.
- Governance artifacts are versioned alongside specs; changes require RFC-Governance approval.

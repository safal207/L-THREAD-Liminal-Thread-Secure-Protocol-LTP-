# LTP Governance

This document defines how the Liminal Thread Protocol (LTP) is guided to remain reliable, explainable, and backwards compatible as it matures from a project into a standard.

## Purpose
Governance exists to keep the protocol coherent, predictable, and trustworthy for contributors, vendors, and implementers.

## Roles
- **Maintainer** – Owns the strategic direction, stewards releases, and can exercise a temporary veto to protect core stability.
- **Editor** – Facilitates the RFC process, ensures proposals are clear, and shepherds accepted changes into the specification.
- **Contributor** – Anyone proposing, discussing, or implementing changes through the RFC process.

## Principles
- **Frozen Core (v0.1)** – The minimal interoperable subset of LTP is treated as frozen; changes to it require explicit justification and extra scrutiny.
- **Backward compatibility** – Breaking changes are avoided; if unavoidable, they must be gated, versioned, and clearly documented.
- **Explainability over performance** – Readability, auditability, and predictable behavior are prioritized over micro-optimizations.

## Decision Model
- **Rough consensus** – Decisions are made when there is clear, reasoned support with no sustained objections.
- **Maintainer veto (temporary)** – The Lead Maintainer can pause or reject changes that threaten stability or the Frozen Core. Veto use must be documented with rationale and a path to resolution.
- **Transparent record** – All decisions, rationales, and dissent are captured in the RFC thread to preserve institutional memory.

## Change Control
All substantive protocol changes follow the RFC process. Informational updates and editorial fixes may be merged by Editors when they do not affect semantics.

## Release Cadence
- Patch releases address clarifications and non-breaking fixes.
- Minor releases may introduce additive features that preserve backward compatibility.
- Major releases are reserved for coordinated breaking changes that have been signaled early in the RFC process.

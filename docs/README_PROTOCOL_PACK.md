# LTP v0.1 Protocol Pack

This pack introduces LTP v0.1 for builders, product teams, and stakeholders. It aligns with the frozen v0.1 specs and keeps language, transport, and storage choices open.

## Who Each Doc Is For
- **`WHITEPAPER_LTP_v0.1.md`** — Protocol introduction for engineers and product leads; summarizes problem, primitives, design principles, safety, and roadmap.
- **`MARKET_NARRATIVE_LTP_v0.1.md`** — Category framing for builders, investors, and enterprise sponsors; positions LTP as the orientation protocol layer.
- **`PITCH_ONE_PAGER_LTP_v0.1.md`** — Fast context for conversations and demos; highlights problem, solution, defensibility, and milestones.
- **`GLOSSARY_LTP_v0.1.md`** — Shared vocabulary across teams; keeps orientation, routing, and conformance terms consistent.

## How Docs Map to Specs
- **Frames:** See `specs/LTP-Frames-v0.1.md` for canonical shapes used throughout the pack.
- **Canonical Flow:** See `specs/LTP-Canonical-Flow-v0.1.md` for deterministic sequencing referenced in every doc.
- **Conformance:** See `specs/LTP-Conformance-v0.1.md` for required behavior that underpins the promises made here.
- **Additional flow context:** `specs/LTP-Flow-v0.1.md` and related files provide transport notes; all documents assume transport-/storage-/language-agnostic operation.

## How to Propose Changes
- **Versioning discipline:** Do not break v0.1 frame shapes or canonical flow ordering. Additive changes only.
- **Change requests:** Open an issue or PR referencing the affected spec and doc; include rationale and impact on determinism and explainability.
- **Compatibility:** If introducing extensions, mark them optional, ignore-optional for older nodes, and preserve silence-as-signal behavior.
- **Publishing:** Update this README with new documents or spec references as versions evolve; ensure conformance guidance stays in lockstep with spec revisions.

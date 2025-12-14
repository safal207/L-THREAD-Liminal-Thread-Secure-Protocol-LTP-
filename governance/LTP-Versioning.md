# LTP Versioning (v0.1)

Versioning provides psychological safety for adopters while keeping the protocol honest about change. LTP treats time as a first-class citizen — versions are layered, not replaced.

## Principles
- **v0.x — additive extensions.** New capabilities are optional and must not break v0.1 conformant captures, flows, or fixtures.
- **v1.0 — core frozen.** The minimal core is locked; only explanatory clarifications or compatibility profiles may be added via RFC-Core.
- **Deprecated ≠ removed.** Deprecated behaviors remain valid; replacements are additive and must coexist.
- **Historical truth.** Old frames and flows remain canonical records for audits and reproductions.

## Layering Model
- **Surface stability:** Frames listed in `specs/LTP-Frame-Spec-v0.1.md` remain valid indefinitely unless superseded by additive aliases.
- **Flow evolution:** Flow updates are versioned via RFC-Flow and signaled in the frame payloads when necessary.
- **SDK & node support:** Implementers SHOULD advertise supported versions and ensure downgrades to v0.1 remain deterministic.

## Release Labels
- **Preview:** Proposed features gated behind flags or profiles; not required for conformance.
- **Stable:** Eligible for production; accompanied by fixtures and conformance updates.
- **Frozen:** No further semantic change without RFC-Core.

## Compatibility Contracts
- Conformance badges MUST state the version line they target.
- Fixtures in `fixtures/conformance/v0.1` remain authoritative for v0.1.
- Upgrades MUST include rollback guidance and capture format continuity.

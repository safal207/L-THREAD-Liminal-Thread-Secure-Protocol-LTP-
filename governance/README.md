# Governance / RFC Front Door

Governance keeps the Liminal Thread Protocol additive, neutral, and predictable by documenting how changes are proposed, decided, and recorded. It favors small artifacts, open discussion, and interoperability-first decisions.

- **RFCs** describe proposed changes (protocol, governance, tooling) before they land.
- **ADRs** capture decisions and their consequences after a proposal is accepted or rejected.

## Lifecycle states
- **RFC:** Draft → Proposed → Accepted/Rejected → Implemented
- **ADR:** Proposed → Accepted → Superseded

## 3-step flow
1. **Open an RFC PR** under `governance/rfcs/` using the template and next numeric ID.
2. **Decide and merge**: reviewers/maintainers accept or reject; status is updated in the RFC and index.
3. **Record the outcome** with an ADR for any significant decision (accepted or rejected paths) and link it back to the RFC.

## Indexes
- [RFC Index](./rfcs/INDEX.md)
- [ADR Index](./adr/INDEX.md)

## Templates & process docs
- [RFC Template](./rfcs/RFC_TEMPLATE.md)
- [RFC Process](./rfcs/PROCESS.md)
- [ADR Template](./adr/ADR_TEMPLATE.md)
- [Decision/ADR Process](./adr/PROCESS.md)

IDs are zero-padded (`0001-short-title.md`) and increment in order of acceptance. Keep titles short, note owners, and always record compatibility/interop impact.

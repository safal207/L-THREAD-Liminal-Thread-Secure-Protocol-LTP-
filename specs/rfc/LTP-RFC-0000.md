# LTP-RFC-0000: Governance and RFC Process

## Status
Active

## Abstract
This RFC defines the lightweight governance model, lifecycle states, numbering rules, and workflow for authoring and maintaining Liminal Thread Protocol RFCs.

## Roles
- **Editor:** Curates the RFC process, manages numbering, ensures consistency, and merges approved changes.
- **Maintainer:** Owns specific protocol areas; reviews for technical soundness and backwards compatibility.
- **Advisory Board:** Provides non-blocking feedback on strategic or cross-domain concerns.

## Lifecycle
1. **Draft** – Authoring in progress. Editor may reserve a number in the index.
2. **Proposed** – Ready for broader review; discussion link required.
3. **Accepted** – Approved for inclusion; implementation or rollout may be pending.
4. **Active** – Normative and in effect; referenced by specs and implementations.
5. **Deprecated** – Superseded or withdrawn; migration guidance is mandatory.

## Numbering and filenames
- Use `LTP-RFC-XXXX` with zero-padded numbers.
- Reserve the next available number in `index.json` before opening a Proposed RFC.
- RFC-0000 is reserved for governance; numbers grow monotonically.

## When to create an RFC
Propose an RFC for protocol semantics, conformance rules, security posture, governance changes, or cross-cutting tooling that affects multiple components. Editorial fixes to existing RFCs can merge with Editor and Maintainer approval without a new RFC number.

## Workflow
1. **Drafting:** Copy [`TEMPLATE.md`](./TEMPLATE.md), fill metadata, and add a placeholder entry in `index.json` with status `Draft`.
2. **Proposal:** Move status to `Proposed`, add discussion link, and request review from relevant Maintainers and an Editor.
3. **Acceptance:** After feedback, the Editor updates status to `Accepted` and records decision notes in the RFC.
4. **Activation:** When the change is normative for implementations, update status to `Active` and ensure dependent docs reference it.
5. **Deprecation:** Mark RFC as `Deprecated`, provide migration guidance, and update `index.json` with superseding references.

## Change management
- Substantive edits to Accepted or Active RFCs require Maintainer and Editor approval.
- Superseding changes should cite prior RFC numbers and describe migration expectations.
- Security-impacting changes must summarize risks and mitigations.

## Discussion and transparency
- Every Proposed RFC must link to an accessible discussion or decision log.
- Editors should summarize key decisions in the RFC body to preserve context.
- Advisory Board feedback is encouraged for protocol-level risks or strategic shifts.

## Backward compatibility
RFC authors must describe migration paths or compatibility constraints when changes could break existing deployments.

## Security considerations
The process should surface risks early. Editors and Maintainers should flag incomplete threat analyses before acceptance.

## Open questions
- How often to rotate Editors and Advisory Board participants.
- Whether to automate status transitions via tooling.

---

### Checklist
- [ ] Index entry created or updated
- [ ] Discussion link added (for Proposed and beyond)
- [ ] Status advanced with approvals recorded

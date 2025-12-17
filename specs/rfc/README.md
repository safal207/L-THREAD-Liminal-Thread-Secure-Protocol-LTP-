# LTP RFCs

This directory hosts the Liminal Thread Protocol Request for Comments (RFC) process. Each RFC captures a coherent change to the protocol, governance, or surrounding tooling.

## How RFCs are structured
- **Numbering:** `LTP-RFC-XXXX` where `XXXX` is zero-padded. Reserved values should be recorded in the index before drafting.
- **Template:** Authors start from [`TEMPLATE.md`](./TEMPLATE.md) and fill in the required sections.
- **Statuses:** `Draft → Proposed → Accepted → Active → Deprecated` as defined in [`LTP-RFC-0000`](./LTP-RFC-0000.md).
- **Ownership:** Each RFC lists its Editor and any Maintainers accountable for updates.

## Lifecycle and status tracking
- **Draft:** Early content under active iteration by the author(s).
- **Proposed:** Ready for broader review; discussion links must be included.
- **Accepted:** Approved for inclusion pending implementation or rollout.
- **Active:** In effect and normative for implementations.
- **Deprecated:** Superseded or removed; migration guidance must be documented.

Status, number, title, and links are tracked in [`index.json`](./index.json). RFCs may also embed discussion or decision log URLs in their front matter.

## Discussion and review
- Open a discussion thread or issue and link it from the RFC header.
- Proposed RFCs request review from the current Editor(s) and relevant Maintainers.
- Advisory Board feedback is optional but encouraged for significant changes.

## Accepting changes
- Follow the workflow defined in [`LTP-RFC-0000`](./LTP-RFC-0000.md).
- Substantive edits to Accepted or Active RFCs require Maintainer approval and an Editor sign-off.
- Deprecations must include migration notes and an entry in the index.

## When to write an RFC
Create an RFC when altering protocol semantics, conformance expectations, governance rules, security posture, or cross-cutting tooling that impacts multiple components. Smaller editorial fixes can land directly with Maintainer review.

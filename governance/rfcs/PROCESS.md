# RFC Process

RFCs document intent before code or spec changes land. They stay small, compatibility-first, and traceable to ADRs once decided.

## Numbering & filenames
- Use the next zero-padded ID: `0001-short-title.md`.
- Update the [RFC Index](./INDEX.md) with ID, title, status, owner, and link.

## RFC Lifecycle

The RFC process proceeds through the following distinct stages:

1.  **Draft:** The initial stage of an RFC. A draft is a well-formed idea submitted as a pull request using the official [RFC Template](./RFC_TEMPLATE.md). It must clearly articulate the problem, the proposed solution, and its impact.

2.  **Review:** Once a PR is opened, the RFC enters the review stage. This is a period for public discussion, feedback, and refinement. RFC Editors will guide the author, and community Reviewers will assess the proposal's technical merits.

3.  **Accepted:** After the review period, if the proposal reaches consensus among Maintainers, the RFC is accepted. The PR is merged, and the RFC's status is updated to "Accepted" in both the document and the [RFC Index](./INDEX.md).

4.  **Implemented:** The changes described in the accepted RFC are implemented in the relevant parts of the ecosystem (e.g., protocol specifications, SDKs, nodes).

5.  **Released:** The implementation is included in an official, versioned software release. The RFC's status may be updated to reflect the version in which it was released.

## Core Principles & Rules

- **Compatibility First:** All changes must prioritize backward compatibility. Breaking changes are subject to extreme scrutiny and require a comprehensive migration plan.
- **Document Conformance Impact:** Every RFC must detail its impact on the protocol's conformance. This includes identifying which test fixtures need to be added, modified, or removed.
- **Core Changes Mandate Conformance Updates:** **Any change, no matter how small, that affects the LTP Core protocol MUST be accompanied by corresponding updates to the official conformance fixtures.** This is a non-negotiable requirement for an RFC to be considered "Implemented."
- **Traceability:** Significant outcomes of an RFC should be recorded in an Architecture Decision Record (ADR), which links back to the original RFC.

## Minimal steps (IETF-style)
1. **Submit** an RFC PR with the next ID and owners/reviewers filled in.
2. **Decide** via review; record Accepted or Rejected in the RFC and index when merging.
3. **Record** significant outcomes with an ADR that links back to the RFC.

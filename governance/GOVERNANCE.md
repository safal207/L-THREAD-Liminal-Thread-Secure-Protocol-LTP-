# LTP Governance

This document outlines the governance model for the Liminal Thread Protocol (LTP). It defines roles, responsibilities, and the decision-making process to ensure the protocol's long-term stability, neutrality, and evolution.

## Roles and Responsibilities

### Maintainers
Maintainers are responsible for the overall health and direction of the LTP project. They have final authority on releases, repository management, and governance decisions.

- **Responsibilities:**
  - Merge pull requests.
  - Nominate and approve new Maintainers and RFC Editors.
  - Uphold the protocol's ethos and technical vision.
  - Manage security disclosures and incident response.

### RFC Editors
RFC Editors are responsible for the quality and consistency of the RFC (Request for Comments) process. They ensure that RFCs are well-drafted, coherent, and ready for review.

- **Responsibilities:**
  - Guide RFC authors on process and formatting.
  - Ensure RFCs have clear motivation, compatibility analysis, and security considerations.
  - Announce new RFCs and facilitate discussions.
  - Update RFC statuses in the official index.

### Reviewers
Reviewers are community members who contribute by providing feedback on RFCs and pull requests. Anyone can be a reviewer.

- **Responsibilities:**
  - Provide constructive, technical feedback.
  - Assess proposals for technical feasibility, security implications, and backward compatibility.
  - Adhere to the project's code of conduct.

### Advisory Board
The Advisory Board consists of external experts who provide strategic guidance on the protocol's long-term evolution, market positioning, and security landscape. Their role is purely advisory.

- **Responsibilities:**
  - Provide non-binding advice on high-impact RFCs.
  - Help maintain the protocol's neutrality.
  - Offer insights into industry standards, security threats, and infrastructure trends.

## Decision-Making Process

1.  **RFCs for Substantive Changes:** All significant changes to the protocol (including its core, APIs, and semantics) MUST be proposed as an RFC.
2.  **Lazy Consensus:** For most decisions, we use a "lazy consensus" model. If no one raises a significant objection within a reasonable time frame (typically 7 days for minor changes, 14 for major), the proposal is considered approved.
3.  **Majority Vote:** If lazy consensus cannot be reached, Maintainers will hold a vote. A simple majority is required for the proposal to be accepted.
4.  **Security Veto:** Any Maintainer can veto a change on the grounds of a critical security vulnerability. This veto must be accompanied by a detailed, private explanation to other Maintainers.

## Adding and Removing Members

- **Maintainers & RFC Editors:** New members are nominated by an existing Maintainer and must be approved by a majority vote of all current Maintainers.
- **Advisory Board:** New advisors are invited by the Maintainers based on their expertise and reputation in relevant fields.
- **Removal:** A member can be removed by a unanimous vote of all other Maintainers for violating the code of conduct or for prolonged inactivity.

## Security Escalation Path

1.  **Disclosure:** Security vulnerabilities should be reported privately to the Maintainers as described in the `SECURITY.md` file.
2.  **Assessment:** Maintainers will privately assess the vulnerability's impact and severity.
3.  **Patch & Release:** A patch will be developed and prepared for a coordinated release.
4.  **Public Notification:** Once the patch is released, a public advisory will be issued.

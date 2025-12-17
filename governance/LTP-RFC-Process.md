# LTP RFC Process

The RFC process is how LTP evolves with discipline. It welcomes contributions while protecting interoperability, explainability, and backward compatibility.

## What Counts as an RFC
Any substantive change to protocol semantics, wire formats, security posture, or normative references requires an RFC. Informational notes and editorial fixes may skip the process when they do not alter behavior.

## RFC Types
- **Informational** – Provides guidance, context, or non-normative recommendations.
- **Standards Track** – Introduces or modifies normative behavior, protocol flows, or required conformance.
- **Experimental** – Explores ideas that may become Standards Track; they must be scoped, time-bounded, and clearly marked as optional.

## Lifecycle
1. **Proposal** – A concise problem statement and motivation are filed as a pull request adding a new RFC document. Scope and potential impact on the Frozen Core must be declared.
2. **Discussion** – The community and Editors review, request clarifications, and suggest alternatives. Rough consensus is sought; objections must be reasoned and actionable.
3. **Draft** – Once consensus emerges, the RFC is refined for completeness: rationale, security considerations, migration notes, and conformance implications are documented.
4. **Accepted / Rejected** – Editors record the decision and rationale. Accepted RFCs are scheduled for implementation and tracked in release planning. Rejected RFCs remain discoverable with reasons so ideas are not lost.

## Breaking Changes
A change is breaking if it removes or alters existing behavior, requires new mandatory fields, changes cryptographic primitives, or invalidates previously valid messages. Breaking proposals must:
- Clearly enumerate migration steps and compatibility shims.
- Provide versioning or negotiation strategies.
- Flag any Frozen Core impact for extra scrutiny.

## Version Freezes
When a release is declared feature-complete, Editors may freeze changes except for critical fixes. Frozen windows protect implementers and downstream adopters preparing for rollout.

## Documentation and Tracking
Each RFC lives in the repository under `governance/rfcs/` or a future designated location. The RFC pull request serves as the canonical discussion log, and decisions are summarized in the document header for quick reference.

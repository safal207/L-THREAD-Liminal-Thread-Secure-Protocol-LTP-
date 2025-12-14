# LTP RFC Process

The Request for Comments (RFC) process is the cornerstone of LTP governance. It is the sole mechanism for proposing, debating, and ratifying changes to the LTP specification. This process is designed to be transparent, collaborative, and biased toward careful, conservative evolution.

## How Proposals Are Made

1.  **Idea and Discussion:** Before writing a formal RFC, it is highly encouraged to discuss the idea with the community. This can be done via GitHub Issues or other designated forums.
2.  **Drafting an RFC:** A formal proposal is written using the official RFC template. The draft must be clear, well-motivated, and thoroughly address all required sections, including backward compatibility and security considerations.
3.  **Submission:** The draft is submitted as a pull request to the main LTP repository. This marks the beginning of the formal review process.

## The RFC Lifecycle

An RFC progresses through a series of states:

1.  **Draft:** The initial state of a pull request. The proposal is under active discussion and refinement.
2.  **In Review:** An RFC Editor has reviewed the draft for completeness and clarity, and it is now undergoing formal review by the community and Maintainers.
3.  **Accepted:** The proposal has achieved rough consensus among the Maintainers and the community. The RFC pull request is merged, and the specification is updated.
4.  **Implemented:** The changes defined in the RFC have been implemented in the reference SDKs and validated by the conformance suite.
5.  **Final:** The changes are included in a stable protocol version release. At this point, the RFC is considered complete and immutable.

## Versioning and Evolution

The evolution of LTP is tied directly to the RFC process. Protocol versions are not arbitrary; they reflect the accumulation of accepted and implemented RFCs.

-   **Patch Versions (e.g., v0.1.1):** Reserved for backward-compatible bug fixes in the specification or documentation. Do not require an RFC.
-   **Minor Versions (e.g., v0.2.0):** Introduce new, backward-compatible features (e.g., a new optional frame type). **Require an accepted RFC.**
-   **Major Versions (e.g., v2.0.0):** Introduce breaking changes to the protocol. This is an extremely rare event, requiring an exceptionally high degree of consensus, a strong justification, and a detailed migration plan. **Requires an accepted RFC.**

## The Golden Rule: Backward Compatibility

Stability is paramount. The RFC process is heavily weighted to enforce backward compatibility.

-   Any change that is not backward-compatible is considered a "breaking change" and is subject to the highest level of scrutiny.
-   Proposals must prove that a breaking change is not only necessary but that the benefit to the ecosystem massively outweighs the cost of migration.
-   By default, all changes should be additive and optional, allowing older clients to gracefully ignore new features they do not understand.

The governance model defaults to **slow, conservative change**. This ensures that implementers can build on LTP with confidence, knowing that the ground will not shift under them.

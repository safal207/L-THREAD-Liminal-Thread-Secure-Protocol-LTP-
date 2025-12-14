# LTP Governance Model

## Philosophy: Stewardship, Not Ownership

The Liminal Thread Protocol (LTP) is intended to be a neutral, open standard for the entire industry. As such, its governance is founded on the principle of **stewardship, not ownership**. No single company or individual owns LTP. Instead, a group of stewards (Maintainers, RFC Editors, and Advisors) is entrusted with guiding its evolution in a way that serves the entire ecosystem, not just the interests of a single party.

This model is inspired by the successful governance of foundational internet technologies and open-source projects like those managed by the IETF, CNCF, and the Rust Foundation.

## Core Tenets

1.  **Open Participation:** Anyone can contribute to LTP by proposing RFCs, participating in discussions, and reviewing changes.
2.  **Transparent Decision-Making:** All decisions regarding the protocol's evolution are made publicly through the RFC process.
3.  **Conservative Pace:** Stability is the most critical feature of a protocol. The governance model is designed to favor slow, deliberate, and backward-compatible changes.
4.  **Separation of Concerns:** There is a clear and intentional separation between the protocol specification, the software that implements it, and any commercial services built upon it.

## Separation Between Spec, Implementations, and Services

To maintain neutrality, the governance model enforces a clear separation:

-   **The Specification (The Protocol):** The LTP specification is the primary artifact. It is a pure document, governed by the open RFC process. The goal of governance is to protect and evolve this specification.
-   **Implementations (SDKs, Nodes):** Software that implements the LTP specification is a separate concern. While this repository may host one or more "reference" implementations, any implementation that passes the official conformance suite is a valid and equal citizen of the ecosystem. The governance of these software projects is separate from the governance of the protocol itself.
-   **Commercial Services (The Market):** Companies are encouraged to build commercial services around LTP (e.g., managed nodes, consulting, conformance testing). These services are vital for a healthy ecosystem but have no direct influence on the protocol's governance. The protocol remains a neutral substrate for the market, not a product to be sold.

## Decision-Making and Roles

The formal decision-making process, including the roles of Maintainers, RFC Editors, Reviewers, and the Advisory Board, is detailed in the [LTP RFC Process](./LTP-RFC-Process.md) document. The model is designed to empower these stewards to act in the best long-term interests of the protocol and its users.

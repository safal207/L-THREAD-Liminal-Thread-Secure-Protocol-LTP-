# LTP Roadmap: v0.1 to v1.0

This document outlines the high-level roadmap for the Liminal Thread Protocol (LTP) from its foundational v0.1 release to the long-term stable v1.0 milestone. The guiding principle of this roadmap is **stability over features**. The primary goal is to establish LTP as a reliable, permanent standard.

---

## **v0.1 — Foundation (Complete)**

*   **Status:** Stable and Frozen
*   **Focus:** Establishing a minimal, viable, and permanent core.

The purpose of v0.1 was to define the atomic components of the protocol and prove their utility. This version is considered "frozen," meaning its core feature set is guaranteed to be supported in all future 1.x versions.

-   **Key Deliverables:**
    -   Formal specification of core frame types (`hello`, `heartbeat`, `orientation`, `route_request`, `route_response`).
    -   Canonical flow definition for a complete client-server interaction.
    -   Initial conformance kit for verifying implementations.
    -   Reference implementations (JS/Rust SDKs) that pass conformance tests.
    -   Formalization of the governance process via RFC-0001.

---

## **v0.2 — Ecosystem Enablement (In Progress)**

*   **Status:** Under Development
*   **Focus:** Broadening adoption and providing tools for the community.

With a stable core, the next phase focuses on making LTP easier to adopt, integrate, and build upon. This involves improving developer experience, expanding language support, and clarifying the commercial ecosystem.

-   **Key Deliverables:**
    -   **Multi-language SDKs:** Mature SDKs for Python and Elixir, joining the existing JS and Rust implementations.
    -   **Conformance-as-a-Service:** A public, web-based endpoint for validating LTP frame sequences, allowing developers to easily test their implementations.
    -   **Improved Documentation:** Richer tutorials, architectural diagrams, and use-case examples.
    -   **Advisory Board Formation:** Seating the initial members of the technical advisory board.

---

## **v0.3 to v0.9 — Hardening and Refinement**

*   **Status:** Planned
*   **Focus:** Security, performance, and formal standardization.

This series of releases will focus on maturing the protocol without introducing breaking changes to the v0.1 core. Each release will be driven by the formal RFC process.

-   **Potential RFCs & Areas of Focus:**
    -   **Formal Security Model:** A comprehensive threat model and specifications for end-to-end encryption and signing of frames.
    -   **Performance Optimization:** Introduction of optional binary encodings (e.g., CBOR, Protocol Buffers) for performance-critical applications.
    -   **Transport Agnosticism:** Formal guidelines for running LTP over transports other than WebSocket (e.g., QUIC, MQTT).
    -   **IETF Standardization:** Beginning the process of drafting an official IETF specification for LTP.

---

## **v1.0 — Stable Protocol**

*   **Status:** Future Milestone
*   **Focus:** Long-term stability and permanent adoption.

v1.0 will mark the point at which LTP is considered a complete, mature, and permanent protocol. Reaching v1.0 does not signify the end of development, but rather the establishment of a rock-solid foundation that the industry can rely on for decades.

-   **Criteria for v1.0:**
    -   The v0.1 core has remained stable and unchanged.
    -   A formal security model is specified and implemented in reference SDKs.
    -   At least four stable, production-grade SDKs exist for different language ecosystems.
    -   The protocol has been deployed in multiple, independent production systems.
    -   The IETF standardization process is well underway.

The timeline for v1.0 is intentionally not defined by a date, but by the achievement of these maturity and adoption milestones.

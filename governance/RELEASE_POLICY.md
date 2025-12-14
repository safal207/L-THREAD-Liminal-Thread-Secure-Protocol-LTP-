# Release Policy and Compatibility

This document defines the rules for versioning and releasing LTP components, including the protocol itself, SDKs, and nodes. The goal is to ensure predictability and stability for the ecosystem.

## Versioning Scheme

We follow a strict interpretation of Semantic Versioning (SemVer). Given a version number `MAJOR.MINOR.PATCH`, we increment the:

- **`MAJOR`** version for incompatible API changes. For the LTP protocol, this corresponds to a new protocol version (e.g., `v:"0.2"`).
- **`MINOR`** version for adding functionality in a backward-compatible manner. This includes new, optional frames or new, optional fields in existing frames.
- **`PATCH`** version for backward-compatible bug fixes that do not change observable behavior, except to correct it.

## Release Stages

- **Alpha:** Early, experimental releases. Unstable, may contain breaking changes between patch versions. Not for production use.
- **Beta:** Feature-complete but may contain known bugs. API is stabilizing. Suitable for testing and integration, but not for production guarantees.
- **Stable:** Production-ready. API is stable and has been tested in real-world scenarios.

## The Governance-Release-Conformance Cycle

Every significant change to the protocol MUST follow this lifecycle:

1.  **RFC (Request for Comments):** A change is proposed via the RFC process.
2.  **Release:** Once the RFC is accepted, the change is implemented and included in a new software release. The release version MUST correspond to the nature of the change (Patch, Minor, or Major).
3.  **Conformance:** The release is validated by the official `conformance-kit` to ensure it adheres to the RFC and does not break compatibility rules.

This strict coupling ensures that every release is traceable to a governance decision and is verified to be compatible.

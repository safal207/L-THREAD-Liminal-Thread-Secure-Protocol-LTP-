# LTP Governance

The goal of this governance is to keep LTP deterministic and inspectable while allowing the protocol and its ecosystem to grow.
No single organization, company, or individual controls LTP, but changes that affect orientation and replayability must be curated.

PR #220 established golden traces and inspectors as the verification backbone of the protocol.
This governance formalizes who may evolve that backbone and how core changes are approved.

## Roles and Permissions

### Core Maintainers
- **Who:** The project lead and explicitly designated maintainers.
- **Permissions:**
  - Modify `core/`, `protocol/`, and the golden trace format and contents.
  - Approve RFCs that affect protocol semantics or determinism.
  - Define and evolve orientation invariants and trace meaning.
- **Responsibilities:**
  - Provide backward reasoning for every core change: why it is admissible and how determinism is preserved.
  - Keep conformance fixtures and golden traces current.
  - Preserve canonical semantics and guard against semantic drift.
- Only Core Maintainers may approve changes that affect protocol semantics, orientation invariants, or trace format/meaning.

### Contributors
- **Who:** Any external participant.
- **Permissions:**
  - Extend SDKs (JS / Python / Rust / Elixir).
  - Improve tooling (inspectors, visualizers), demos, docs, and tests.
- **Restrictions:**
  - Must not change core semantics or orientation invariants.
  - Must not alter golden traces without an approved RFC and Core Maintainer sign-off.
- Contributors may extend integrations and tooling but may not change protocol invariants.

### Reviewers (optional but encouraged)
- **Who:** Domain experts who provide feedback without merging authority.
- **Permissions:**
  - Review PRs, comment on RFCs, and participate in design discussions.

## Core Change Rules

### Non-negotiable invariants
The following properties are invariants and must remain true across versions:
- Orientation must be explicit and inspectable.
- Transitions must be replayable.
- Golden traces are the source of truth.
- Loss of orientation is a protocol violation.

If these invariants are disputed, a fork is acceptable; they define the canonical line.

### Requirements for any core change
Any change that touches `core/`, `protocol/`, or golden traces requires:
1. An RFC, even for small adjustments.
2. An updated or new golden trace demonstrating the behavior.
3. A deterministic explanation that defends the change and notes clear non-goals.

Core changes must be justified by a reproducible trace and an explanation that proves determinism is preserved.

## Why this governance exists
This model is intentionally strict to:
- Prevent semantic drift.
- Enable long-term evolution without losing orientation.
- Allow independent implementations to interoperate via stable traces.
- Protect contributors from accidental protocol breakage.

Adoption does not require permission, and forking is explicitly allowed, but the canonical protocol line is defined by these rules.

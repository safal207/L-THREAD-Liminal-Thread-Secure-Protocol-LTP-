# LTP RFC Process

RFCs are required for any change that affects `core/`, `protocol/`, or the golden traces that define canonical behavior.
They provide a deterministic, inspectable path for evolving the protocol without losing orientation.

## When to write an RFC
- Changing protocol semantics or orientation invariants.
- Updating golden traces or conformance expectations.
- Introducing new frame types or modifying existing ones.
- Altering inspector or replay assumptions in ways that affect determinism.

## RFC contents (minimum)
- **Problem statement** — what changes and why.
- **Deterministic rationale** — how the change preserves orientation and replayability; note explicit non-goals.
- **Trace evidence** — a reproducible golden trace (or update) that demonstrates the behavior.
- **Compatibility** — required updates to specs, SDKs, and tooling.
- **Reviewers** — Core Maintainer sponsor and subject-matter reviewers (if any).

## Relationship to governance
PR #220 established golden traces and inspectors as the verification backbone of the protocol.
Per [GOVERNANCE.md](../GOVERNANCE.md), only Core Maintainers may approve RFCs that change protocol semantics, invariants, or trace meaning.

## Review and acceptance
- Submit the RFC in `rfc/` and open a PR.
- Gather feedback from reviewers; address comments in the document.
- Core Maintainer approval is required to accept the RFC and merge associated trace updates.

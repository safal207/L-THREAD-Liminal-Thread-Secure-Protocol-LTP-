# RFC Process

RFCs document intent before code or spec changes land. They stay small, compatibility-first, and traceable to ADRs once decided.

## Numbering & filenames
- Use the next zero-padded ID: `0001-short-title.md`.
- Update the [RFC Index](./INDEX.md) with ID, title, status, owner, and link.

## Lifecycle
- **Draft:** Open PR with an RFC using the template. Capture motivation and interop impact.
- **Proposed:** Active discussion; reviewers and Advisory Board (optional) comment.
- **Accepted / Rejected:** Decision recorded in the RFC + index. Link to the ADR when written.
- **Implemented:** Specs/code/fixtures merged; status updated.

## Expectations
- Always document compatibility/interop and conformance impacts.
- Prefer additive changes; removals need explicit justification and migration steps.
- Reference fixtures, SDKs, or telemetry that validate the change.

## Minimal steps (IETF-style)
1. **Submit** an RFC PR with the next ID and owners/reviewers filled in.
2. **Decide** via review; record Accepted or Rejected in the RFC and index when merging.
3. **Record** significant outcomes with an ADR that links back to the RFC.

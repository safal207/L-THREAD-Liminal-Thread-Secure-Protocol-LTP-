# Start Here — Contributing to LTP

LTP is a deterministic oversight and replay protocol for agent traces. It helps teams inspect whether an AI or agent followed an admissible, grounded execution path, detect drift, reject unsupported outputs or actions, and preserve audit-grade evidence for high-risk workflows.

This page is the shortest path from “I found the repository” to “I know where I can safely contribute.”

## 10-minute onboarding path

1. Read the project summary in the root `README.md`.
2. Run the local validation commands from the README.
3. Read `CONTRIBUTING.md` to understand contribution boundaries.
4. Skim `specs/LTP-Spec-v0.1.md` for protocol vocabulary.
5. Check open issues labeled `good first issue` or `help wanted`.

## First things to understand

LTP is not trying to be a general-purpose agent framework. Its core job is to make agent execution paths:

- inspectable,
- replayable,
- rejectable when unsupported,
- usable as audit-grade evidence.

The core nouns are:

- **Trace** — ordered record of an agent execution path.
- **Replay** — deterministic reconstruction or verification of that path.
- **Inspector** — checks whether the path is admissible, drifting, or rejected.
- **Anchor** — evidence or state that supports a claim/action.
- **Conformance fixture** — stable example used to verify compatible implementations.
- **Report** — human/machine-readable evidence artifact.

## Safe contribution zones

These are good places for new contributors:

- Documentation fixes and examples.
- Quickstart validation on clean machines.
- Architecture diagrams.
- SDK examples.
- Conformance fixture documentation.
- CI improvements that do not change protocol semantics.
- Replay/demo visualization.
- Commercial/pilot documentation.

## Changes that need extra review

These areas should go through maintainer discussion or an RFC-style proposal before implementation:

- Protocol semantics.
- Trace schema changes.
- Decision codes and admissibility rules.
- Cryptographic assumptions.
- Golden fixture changes that alter expected behavior.
- Breaking SDK behavior.
- Claims about certification, compliance, or security guarantees.

## Recommended first issues

Start with issues labeled:

- `good first issue` — low-risk onboarding tasks.
- `documentation` — writing, examples, explanations.
- `help wanted` — useful external contributions.
- `enhancement` — feature or developer-experience improvements.

Suggested first contribution types:

1. Verify README quickstart on your OS.
2. Improve docs around a confusing command.
3. Add a small canonical example.
4. Add a diagram explaining the trace → replay → inspect → report flow.

## Local validation

Use the repository README as the source of truth. The current reviewer-safe path is:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm test:conformance
```

When opening a PR, include:

- OS and version.
- Node/Python/Rust versions if relevant.
- Commands you ran.
- Output summary.
- Any known limitations.

## Developer roadmap

For deeper roadmap context, see:

- `docs/roadmap/LTP-Roadmap-v0.1-to-v1.0.md`
- `docs/roadmap/LTP-Developer-and-Commercial-Roadmap.md`

## Commercial and pilot context

Commercial work should not lock the protocol itself. The protocol and conformance foundations should remain open, while value can come from implementation support, hosted validation, audits, integrations, dashboards, certification help, and partner-specific work.

Relevant docs:

- `docs/Commercial-Use-Note.md`
- `economics/LTP-Economics-and-Market-Roles-v0.1.md`
- `docs/commercial/LTP-Pilot-One-Pager.md`
- `docs/commercial/LTP-Audit-Report-Template.md`

## Maintainer expectation

A strong LTP contribution is not just code. It should preserve determinism, explain its evidence assumptions, and make the protocol easier to verify.

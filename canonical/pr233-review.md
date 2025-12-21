# PR #233 Review — CI as the protocol gate

CI as a protocol gate is the correct direction. This PR is an important milestone because it formalizes conformance as a blocking invariant, not documentation. That is how protocols earn trust. A few adjustments will make the CI signal unambiguous for external contributors and downstream adopters.

## Requested improvements

1) Fail-fast semantics  
Please ensure CI fails immediately on the first MUST-level violation. Add a note like:  
> Any MUST violation causes the pipeline to fail. This avoids “green builds with red meaning.”

2) Explicit scope of CI  
Clarify whether CI validates protocol conformance only, or reference implementation correctness. This prevents contributors from misinterpreting failures.

3) Determinism check  
Recommend adding (or documenting) a second run over the same trace:  
> CI MUST verify identical orientation outcomes across repeated runs. Determinism is a protocol invariant — CI is the right place to enforce it.

4) Version pinning  
Explicitly state:  
> CI validates Frozen Core v0.1 only. This protects future evolution and avoids accidental regressions being treated as bugs.

5) Non-goal reminder  
Add a short disclaimer:  
> CI does not assess decision quality, task success, or model accuracy. Keeps LTP clearly positioned as a protocol layer.

## What this PR gets exactly right

- Treats conformance as infrastructure, not guidance.
- Makes violations visible early (before integration, not after).
- Aligns LTP with how real protocols (TLS, QUIC) are validated.

## Natural follow-ups

- #234 — intentionally failing CI example (educational).
- #235 — public conformance badge (per implementation).
- #236 — matrix: SDK × conformance level.

If short:  
#232 — how to test  
#233 — when to trust  
This is where LTP stops being “reviewed” and starts being enforced.

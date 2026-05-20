# Related CaPU Persona-Boundary Evidence

Status: grant/reviewer cross-reference note.

This note records a related executable safety artifact in CaPU that strengthens the LTP trace/replay and continuity narrative.

Related repository:

```text
https://github.com/safal207/CaPU
```

---

## Why this matters for LTP

LTP asks whether agent execution paths can be replayed, inspected, and audited across context transitions.

CaPU / CMC persona-boundary evidence adds a human-facing class of transitions that should be replayable and inspectable:

```text
persona memory update
persona role/state change
persona introspective interpretation
```

The important question becomes:

```text
Can a reviewer replay why an AI persona remembered, adapted, or interpreted something?
```

---

## Current CaPU persona-boundary proof points

CaPU now includes manifest-linked executable persona-boundary fixtures for:

```text
P1: Persona memory requires cause.
P2: Persona state changes require authorization.
P7: Introspection is hypothesis-labeled.
```

Operational summary:

```text
AI must not self-remember.
AI must not self-appoint.
AI must not claim inner truth.
```

---

## Evidence artifacts in CaPU

```text
rust/cmc-core/fixtures/persona/MANIFEST.tsv
rust/cmc-core/fixtures/persona/inferred_preference_rejected.jsonl
rust/cmc-core/fixtures/persona/confirmed_preference_accepted.jsonl
rust/cmc-core/fixtures/persona/unauthorized_persona_state_change_rejected.jsonl
rust/cmc-core/fixtures/persona/authorized_persona_state_change_accepted.jsonl
rust/cmc-core/fixtures/persona/unlabeled_introspection_rejected.jsonl
rust/cmc-core/fixtures/persona/hypothesis_labeled_introspection_accepted.jsonl
rust/cmc-core/src/bin/persona_boundary_verify.rs
```

Reviewer command in CaPU:

```bash
cd rust/cmc-core
cargo run --bin persona_boundary_verify --locked
```

Expected output includes:

```text
cases=6
p1_inferred_result=blocked_unconfirmed_persona_memory
p1_confirmed_result=accepted_confirmed_persona_memory cause_id=42
p2_unauthorized_result=blocked_unauthorized_persona_state_change
p2_authorized_result=accepted_authorized_persona_state_change cause_id=77
p7_unlabeled_result=blocked_claimed_inner_truth
p7_labeled_result=accepted_hypothesis_labeled_reflection
result=persona_boundary_manifest_valid
```

---

## Relationship to LTP

| LTP concern | CaPU persona-boundary complement |
| --- | --- |
| Deterministic replay | Persona transitions become fixture-backed replay targets |
| Trace inspection | Memory/state/introspection transitions can be inspected as decisions |
| Context continuity | Persona continuity must be causally grounded, not only conversationally plausible |
| Drift detection | Unauthorized memory or role drift can become trace-visible |
| Auditor-facing evidence | Manifest-linked persona cases provide compact reviewable examples |

---

## Grant framing

This strengthens the broader LTP grant case:

```text
LTP provides replay and trace inspection for agent continuity.
CaPU provides executable examples of persona-boundary transitions that should be replayed and inspected.
```

Together:

```text
agent continuity should not only be coherent; it should be replayable, inspectable, and causally legitimate.
```

---

## Non-claims

This note does not claim complete AI alignment, AI consciousness, personhood, therapy, or production companion safety.

It records a narrow executable evidence bridge between LTP's replay/trace thesis and CaPU's persona-boundary checks.

---

## One-line summary

```text
CaPU gives LTP concrete persona-transition cases that should be replayable and inspectable: no self-memory, no self-appointment, no inner-truth claims.
```

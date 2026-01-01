# Canon → Contract Map

This map ties the LTP canon (conceptual foundation) to enforceable requirements.

## Legacy Act — Inspector as Mirror (filename alias)
Source: `docs/canon/03-inspector.md`

> NOTE: Legacy filename alias kept only for CI hygiene.
> Prefer `docs/canon/04-inspector.md` everywhere. Remove once 03-inspector.md is deleted.

- **Clause:** "Inspector reveals… does not optimize / does not command"
  - Requirements: LTP-REQ-NONGOAL-NO-HEURISTIC-ADAPT-1, LTP-REQ-NONGOAL-NO-DECISION-1, LTP-REQ-NONGOAL-NO-MODEL-EXEC-1

- **Clause:** "measures drift / continuity"
  - Requirements: LTP-REQ-ORIENT-DRIFT-1

- **Clause:** "explains degraded paths"
  - Requirements: LTP-REQ-INSPECT-EXPLAIN-1

---

## Act 0 — Why LTP Exists
Source: `docs/canon/00-why-ltp-exists.md`

- **Clause:** "What breaks first is orientation."
  - Requirements: LTP-REQ-ORIENT-IDENTITY-1, LTP-REQ-ORIENT-CONTINUITY-TOKEN-1

- **Clause:** "Modern AI is built on snapshots… missing a continuous axis."
  - Requirements: LTP-REQ-NONGOAL-NO-MODEL-EXEC-1, LTP-REQ-NONGOAL-NO-DECISION-1

- **Clause:** "LTP is a living thread through time."
  - Requirements: LTP-REQ-TRACE-JSONL-1, LTP-REQ-TRACE-VERSION-1, LTP-REQ-ORIENT-CONTINUITY-TOKEN-1

- **Clause:** "Prediction degrades with complexity. Orientation does not."
  - Requirements: LTP-REQ-ORIENT-DRIFT-1, LTP-REQ-TRACE-ORDER-DETERMINISM-1

---

## Act I — Orientation over Prediction
Source: `docs/canon/01-orientation-over-prediction.md`

- **Clause:** "LTP: Input → Orientation → Action (continuity over time)"
  - Requirements: LTP-REQ-ORIENT-IDENTITY-1, LTP-REQ-ORIENT-CONTINUITY-TOKEN-1

- **Clause:** "LTP does not predict outcomes; it preserves orientation."
  - Requirements: LTP-REQ-NONGOAL-NO-DECISION-1, LTP-REQ-NONGOAL-NO-HEURISTIC-ADAPT-1

---

## Act II — Orientation as a Living Structure
Source: `docs/canon/02-orientation-node.md`

- **Clause:** Orientation Node fields: identity / focus / drift history / constraints / admissible futures
  - Requirements:
    - identity → LTP-REQ-ORIENT-IDENTITY-1
    - constraints → LTP-REQ-ORIENT-CONSTRAINTS-1
    - drift → LTP-REQ-ORIENT-DRIFT-1
    - admissible futures → LTP-REQ-ORIENT-ADMISSIBLE-FUTURES-1

- **Clause:** "Orientation ≠ decision/policy/reward"
  - Requirements: LTP-REQ-NONGOAL-NO-DECISION-1

---

## Act III — Branches Without Choice
Source: `docs/canon/03-admissible-futures.md`

- **Clause:** "Multiple futures exist. None are chosen by LTP."
  - Requirements: LTP-REQ-ORIENT-ADMISSIBLE-FUTURES-1, LTP-REQ-NONGOAL-NO-DECISION-1

---

## Act IV — Inspector as Mirror
Source: `docs/canon/04-inspector.md`

- **Clause:** "Inspector reveals… does not optimize / does not command"
  - Requirements: LTP-REQ-NONGOAL-NO-HEURISTIC-ADAPT-1, LTP-REQ-NONGOAL-NO-DECISION-1, LTP-REQ-NONGOAL-NO-MODEL-EXEC-1

- **Clause:** "measures drift / continuity"
  - Requirements: LTP-REQ-ORIENT-DRIFT-1

- **Clause:** "explains degraded paths"
  - Requirements: LTP-REQ-INSPECT-EXPLAIN-1

---

## Act V — The Living Thread in Time
Source: `docs/canon/05-living-thread.md`

- **Clause:** "Moments / transitions / ruptures / recovery"
  - Requirements:
    - trace representation → LTP-REQ-TRACE-JSONL-1
    - versioning → LTP-REQ-TRACE-VERSION-1
    - continuity context → LTP-REQ-ORIENT-CONTINUITY-TOKEN-1

- **Clause:** "Continuity is the product."
  - Requirements: LTP-REQ-ORIENT-CONTINUITY-TOKEN-1, LTP-REQ-ORIENT-CONSTRAINTS-1

---

## Act VI — Orientation Is the New Scale
Source: `docs/canon/06-orientation-is-scale.md`

- **Clause:** "As system complexity ↑, prediction reliability ↓; orientation continuity preserves coherence."
  - Requirements: LTP-REQ-ORIENT-DRIFT-1, LTP-REQ-TRACE-ORDER-DETERMINISM-1

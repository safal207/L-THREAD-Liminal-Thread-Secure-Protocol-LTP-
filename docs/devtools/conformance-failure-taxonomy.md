# Conformance Failure Taxonomy (LTP)

Defines canonical failure classes for LTP conformance operations. Each class includes signal, invariants, ownership, and allowed resolution path.

---

## Responsibility Model

| Domain | Responsibility |
| --- | --- |
| Protocol | Semantics, invariants, continuity |
| Inspector | Representation, normalization |
| Integration | Input correctness, environment |
| CI | Detection, reporting |

No failure is a shared problem; each maps to exactly one domain.

---

## Failure Classes

### A. Protocol Violation (❌ core breach)
- **Definition:** LTP invariants are broken.
- **Signals:** `ERROR: PROTOCOL_VIOLATION`.
- **Triggers:** Non-monotonic `drift_history`, orientation snapshots that do not restore state, future branches that violate admissibility constraints.
- **Ownership:** 🟥 Protocol implementation.
- **Resolutions:** Golden update ❌; schema bump possible (major only).

### B. Inspector Mismatch (⚠ representation drift)
- **Definition:** Protocol semantics hold; representation changed.
- **Signals:** `WARN: INSPECTOR_MISMATCH`.
- **Triggers:** Field reorder, display-label rename, JSON format stable but meaning shifted.
- **Ownership:** 🟧 Inspector tooling.
- **Resolutions:** Golden update ✅; schema bump none or minor.

### C. Golden Drift (🟡 expected evolution)
- **Definition:** Intentional behavior change with recorded expectations.
- **Signals:** `INFO: GOLDEN_DRIFT`.
- **Triggers:** Improved admissible routing, added optional fields, stricter normalization.
- **Ownership:** 🟨 Maintainers (through PR).
- **Resolutions:** Golden update ✅ (mandatory); schema bump optional.

### D. Integration Fault (⚠ external misuse)
- **Definition:** Inputs violate contract; LTP rejects correctly.
- **Signals:** `ERROR: INTEGRATION_FAULT`.
- **Triggers:** Malformed orientation, missing identity, invalid timestamp ordering.
- **Ownership:** 🟦 Client / integrator.
- **Resolutions:** Golden update ❌; schema bump ❌.

### E. Environmental Failure (⚠ infra)
- **Definition:** External conditions prevent correct execution.
- **Signals:** `ERROR: ENVIRONMENTAL_FAILURE`.
- **Triggers:** Test race conditions, filesystem/CI flakiness, time skew.
- **Ownership:** ⬜ CI / infra.
- **Resolutions:** Golden update ❌; schema bump ❌.

---

## Decision Matrix

| Failure | Merge | Golden Update | Who fixes |
| --- | --- | --- | --- |
| Protocol Violation | ❌ | ❌ | Core |
| Inspector Mismatch | ✅ | ✅ | Tooling |
| Golden Drift | ✅ | ✅ | Maintainers |
| Integration Fault | ❌ | ❌ | Client |
| Environmental | ⚠ | ❌ | Infra |

---

## CI Enforcement Rules

- Every failure must be classified using the above signals.
- CI must not auto-update goldens.
- CI must not downgrade severity.
- Unknown class = CI failure (`ERROR`).

---

## Non-Goals

- Prescribing fixes.
- Optimizing developer experience.
- Reducing taxonomy scope to preferences.

---

## Related PRs

- #221 — Verification process.
- #222 — Correctness criteria for verification.
- #223 — Failure interpretation (this document).

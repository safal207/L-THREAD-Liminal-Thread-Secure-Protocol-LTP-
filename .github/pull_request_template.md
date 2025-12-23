# Pull Request Checklist (LTP)

Thank you for contributing to LTP.
This template exists to protect the protocol’s core invariants:
orientation, continuity, and safety.

---

## 1) Scope of Change

**What does this PR change?**
- [ ] Protocol spec
- [ ] Node implementation
- [ ] Tooling / CLI
- [ ] Documentation
- [ ] Tests
- [ ] Security / Operational behavior

Brief description (1–3 sentences):

---

## 2) Core Invariants (REQUIRED)

This PR **MUST NOT** violate the following:

- [ ] LTP still does **not** decide outcomes
- [ ] LTP still only validates **admissibility of transitions**
- [ ] Business logic / decisions remain outside the protocol
- [ ] Orientation state remains explicit and traceable
- [ ] Determinism & replayability preserved

If any box is unchecked → explain **why this is safe**:

---

## 3) Security Baseline (v0.1)

If this PR affects networking, sessions, or input handling:

- [ ] Authentication at handshake is enforced
- [ ] Client-provided identity is never trusted blindly
- [ ] Per-connection rate limiting is preserved
- [ ] Sampled / throttled logging is preserved
- [ ] Idle session expiration (TTL + GC) is not weakened

If N/A, explain why:

---

## 4) Failure & Abuse Considerations

Does this change introduce or modify:
- [ ] New failure modes?
- [ ] New attack surface?
- [ ] New untrusted inputs?

If yes, describe:
- how failures stay **local**
- how abuse is detected or bounded

---

## 5) Compatibility & Drift

- [ ] Backward compatibility preserved
- [ ] No silent semantic drift introduced
- [ ] Existing traces remain valid/replayable

If compatibility is broken, explain migration path:

---

## 6) Tests & Verification

- [ ] Unit tests added or updated
- [ ] Existing tests pass
- [ ] Conformance / invariants manually reviewed

How was this tested?

---

## 7) Documentation

- [ ] Docs updated (spec / canon / wiki if needed)
- [ ] Terminology consistent with existing canon
- [ ] No new metaphors without formal meaning

---

## Final affirmation

By submitting this PR, I confirm that:
- LTP remains a **continuity protocol**
- This change does not turn LTP into an agent, model, or decision system
- Scope has not expanded silently


---

Почему это сильный шаг

Ты фактически:

зафиксировал культуру проекта

превратил философию в процедуру

защитил LTP от «медленного расползания смысла»


Это ровно то, что отличает:

> протокол
от
очередного OSS-проекта



Если хочешь, следующий логичный шаг:

📦 ARCHITECTURE.md (1 страница: слои и границы)

🧪 Threat Model Lite (таблица «атака → почему невозможна»)

🏷️ GitHub Labels (core / canon / security / drift-risk)


Скажи, что делаем дальше 👊

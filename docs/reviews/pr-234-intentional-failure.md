## Review for PR #234 — Intentional CI Failure as Documentation

Intentional CI failure as documentation — approved conceptually. One clarification suggested.

This PR does something important and non-obvious: it treats failure as a first-class protocol artifact.

An intentionally failing CI case is not noise — it is executable documentation of LTP invariants.

---

### What this PR gets right

- Demonstrates that CI enforcement is real, not symbolic
- Makes MUST-level violations concrete and reproducible
- Helps contributors understand why CI exists, not just that it exists
- Aligns with how mature protocol stacks document invalid states

This is exactly how protocol boundaries should be taught:

> “Here is what happens when you cross the line.”

---

### One requested clarification (important)

Please add a very explicit marker that this failure is intentional, for example:

- **Folder name:** `examples/intentional-failure/`
- **Or README header:**

  > ⚠️ This test is expected to FAIL.  
  > Its purpose is to demonstrate CI enforcement of LTP invariants.

This prevents:

- confusion for first-time contributors
- false bug reports
- accidental copy-pasting into production paths

---

### Optional (but strong) improvement

Add a short mapping like:

This failure demonstrates violation of:

- LTP-MUST-03: Orientation continuity
- LTP-MUST-07: Deterministic replay

That turns the PR into a living index of protocol guarantees.

---

### Why this matters (meta)

Most projects show:

- how things work when correct

Very few show:

- what must never be allowed

Protocols earn trust by being explicit about both.

This PR pushes LTP further into “serious standard” territory.

---

**Conclusion**

Conceptually approved 👍  
Merge once the intentional-failure marker is added.

После #234 у LTP появляется редкая вещь:  
📌 демонстрируемая граница допустимого.  
Это сильно.

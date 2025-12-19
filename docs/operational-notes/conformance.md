Conformance Is About Shape, Not Output

Operational Notes on Behavioral Compatibility

> This document describes conformance as an operational property of system behavior.
> It does not define correctness criteria for outputs or decisions.



---

1. Conformance Is Not Correctness

Conformance and correctness are frequently conflated.

They describe different concerns.

Correctness evaluates whether an output matches an expected result.
Conformance evaluates whether behavior follows an expected structure.

A system may produce correct outputs while violating conformance.
A system may preserve conformance while producing locally incorrect results.

These cases are not equivalent.


---

2. Why Output-Based Validation Breaks Down

In long-lived systems, validating individual outputs becomes insufficient.

As behavior unfolds over time:

outputs depend on accumulated context

retries alter execution paths

partial recovery introduces divergence

identical inputs no longer guarantee identical outputs


Under these conditions, output comparison loses explanatory power.


---

3. Shape as a Compatibility Contract

Conformance focuses on the shape of behavior rather than its surface values.

Behavioral shape includes:

allowed transition sequences

constraint preservation

admissible branching structure

continuity across failures and retries


This shape defines compatibility between implementations, independent of internal logic.


---

4. Determinism Without Output Equality

Conformant systems do not require identical outputs.

They require:

identical admissibility rules

preserved constraints

consistent transition semantics

reproducible trajectory structure


Determinism applies to structure, not content.


---

5. What Conformance Validates

Conformance validation answers questions such as:

Were constraints applied consistently?

Were invalid branches correctly rejected?

Did recovery preserve orientation?

Did transitions follow declared rules?


It does not answer whether a particular decision was optimal or correct.


---

6. Why This Matters in Practice

Shape-based conformance enables:

interoperability across implementations

CI validation without semantic coupling

auditability without replaying execution

safe evolution of internal logic


These properties are difficult to achieve with output-based validation alone.


---

7. Separation of Responsibility

Conformance frameworks should not evaluate:

decision quality

model accuracy

business outcomes


They should evaluate:

behavioral compatibility

structural integrity

rule adherence over time


Mixing these responsibilities increases coupling and reduces trust.


---

8. Closing Note

Tests verify results.
Conformance verifies form.


---

Commit / PR metadata (рекомендовано)

File path:
docs/operational-notes/conformance.md

Commit message:

docs: operational notes on conformance as behavioral shape

PR title:

docs: conformance is about shape, not output

PR description (одна строка):

> Adds operational notes defining conformance as structural compatibility rather than output correctness.



---

Почему PR #188 — ключевой

он юридически и инженерно отделяет conformance от correctness

объясняет, почему CI-валидация возможна без «знания смысла»

напрямую готовит:

conformance kits

badges

CI steps

enterprise trust



И при этом:

❌ не упоминает LTP напрямую

❌ не продаёт tooling

❌ не сравнивает с конкурентами



---

Теперь у тебя закрыт полный «infra-контур»

1. Continuity exists


2. Drift is normal


3. Recovery ≠ Reset


4. Trajectories can be inspected


5. Conformance validates shape, not output



Это уже не серия PR, а операционная философия, к которой инструменты просто прирастают.

Если хочешь — следующий логичный шаг:

PR #189: Compatibility Survives Implementation Changes
или

аккуратный CI Conformance Example (1 workflow, без шума)


Скажи — идём дальше.

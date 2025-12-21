# LTP Core Conformance Checklist (PR #230)

## Purpose
Defines the minimum, testable criteria required for any implementation to claim conformance with the LTP Core. It does not prescribe architecture, language, storage, or runtime choices.

---

## 1. Core Orientation Invariants (REQUIRED)
An implementation MUST:

- Maintain an explicit orientation frame independent of inference/output.
- Treat orientation as a first-class state, not derived implicitly from tokens or prompts.
- Preserve orientation continuity across:
  - retries
  - restarts
  - process boundaries
  - model/provider changes

Non-conformance example: orientation reconstructed only from prompt history.

---

## 2. Trajectory, Not Output (REQUIRED)
An implementation MUST:

- Represent system evolution as a trajectory of transitions, not isolated responses.
- Allow replay of orientation transitions without re-running a model.
- Separate:
  - transition recording
  - decision execution
  - output rendering

Non-conformance example: storing only final text/action.

---

## 3. Admissibility & Constraints (REQUIRED)
An implementation MUST:

- Encode constraints that define admissible future branches.
- Reject or flag transitions that violate admissibility.
- Make constraint evaluation deterministic and explainable.

Non-conformance example: post-hoc validation without recorded constraint context.

---

## 4. Drift Visibility (REQUIRED)
An implementation MUST:

- Detect and surface orientation drift over time.
- Distinguish between:
  - local error (allowed)
  - loss of orientation (disallowed / discontinuity)

Non-conformance example: silent accumulation of incoherent state.

---

## 5. Determinism & Replay (REQUIRED)
An implementation MUST:

- Produce identical orientation transitions given identical inputs.
- Support replay/audit of transitions independent of runtime conditions.
- Avoid hidden randomness at the protocol level.

Non-conformance example: reliance on wall-clock time or global mutable state.

---

## 6. What Conformance Does Not Require (CLARIFICATION)
A conforming implementation is NOT required to:

- Use a specific model or LLM.
- Provide memory, RAG, or vector storage.
- Perform orchestration or task planning.
- Expose a user interface.

These may exist above the Core.

---

## 7. Claiming Conformance
An implementation MAY claim:

- **“LTP Core Conformant”** — all REQUIRED items satisfied.
- **“LTP-Inspired”** — ideas used, but invariants not fully met.

Misuse of the term “conformant” is considered a specification violation.

---

## 8. Evolution Rule
Any change affecting the meaning of items in sections 1–5 MUST go through the RFC process defined in this repository.

---

## Why This Is a Strong Step
- Shields the Core from dilution.
- Provides a shared language for independent implementations.
- Makes LTP measurable rather than merely explainable.

---

## Next Steps (Optional)
- Add Conformance Test Ideas (no code).
- Link this checklist to Rust/JS nodes.
- Fix a tagged version (e.g., LTP Core v0.1).

# VerifiedTransition: Unforgeable by Design

## Why it matters
In an agentic pipeline, the **Action Boundary** is the critical gatekeeper. It must ensure that any action it executes has been explicitly authorized by the **LTP Admissibility Layer**.

If `VerifiedTransition` were just a plain interface, any code (including malicious plugins or hallucinating LLMs with code execution capabilities) could simply "cast" a raw object to match the interface, bypassing security checks.

## How it works
To prevent this, `VerifiedTransition` is secured using a **private, non-exported unique Symbol (Brand)**.

1.  **Private Brand**: The `VERIFIED_BRAND` symbol is defined locally in the enforcement module and is *never* exported.
2.  **Minting Authority**: The only way to attach this brand to an object is via the internal `mintVerifiedTransition` factory, which is only accessible to the `LTPAdmissibilityChecker`.
3.  **Runtime Guard**: The `ActionBoundary` uses a type guard `isVerifiedTransition` that checks for the presence of this private symbol at runtime.

## Why it cannot be forged
User code cannot create a valid `VerifiedTransition` because:
*   It cannot import the private symbol key.
*   `Symbol('LTP_VERIFIED_TRANSITION') !== Symbol('LTP_VERIFIED_TRANSITION')` (Symbols are unique).
*   Even if they create an object with `verified: true`, the runtime check looks for `[VERIFIED_BRAND]: true`, which they cannot set.

This ensures that **only** transitions that have passed the `LTPAdmissibilityChecker` logic can ever reach the execution stage.

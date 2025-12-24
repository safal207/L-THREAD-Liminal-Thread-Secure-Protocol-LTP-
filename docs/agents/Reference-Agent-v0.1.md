
# Reference Agent Implementation (v0.1)

This directory contains a reference implementation of an LTP-compliant Agent Pipeline.
It serves as a blueprint for building "Safe-by-Design" agents.

## Directory Structure

*   `agents/reference-agent/`
    *   `pipeline.ts`: The main orchestration loop.
    *   `enforcement.ts`: The security kernel (Admissibility Checker & Action Boundary).
    *   `types.ts`: Type definitions ensuring strict separation of Proposal vs. Action.
    *   `adapter.ts`: Examples of how to hook in generic LLMs (OpenAI, LangChain, etc.).

## How to Run Tests

We include a suite of security tests demonstrating resistance to prompt injection.

```bash
pnpm test tests/agents/prompt-injection.spec.ts
```

## Key Invariants

1.  **Symbol-Locked Transitions:** The `VerifiedTransition` type uses a private Symbol to prevent forgery within the runtime. In a distributed system, this would be a cryptographic signature.
2.  **Runtime Enforcement:** The `ActionBoundary` class throws an error if it receives anything other than a `VerifiedTransition`.
3.  **Traceability:** Every allowed action produces a trace entry linked to the admissibility decision.

## Extending

To use this in your project:
1.  Implement `AgentAdapter` to wrap your specific LLM/Framework.
2.  Define your `LTPAdmissibilityChecker` logic (or connect to an LTP Node).
3.  Ensure your `ActionExecutor` is wrapped in the `ActionBoundary`.

# Action Boundary Guarantees

This document defines the security and integrity guarantees provided by the LTP Reference Agent Pipeline.

## The Core Guarantee: "Permission over Action"

Unlike traditional agent frameworks where the LLM decides and acts (Cognition → Action), LTP enforces a strict separation: **Cognition → Proposal → Admissibility (LTP) → Verification → Action**.

The core invariant is:
> **No action execution is possible without a `VerifiedTransition` token minted by the LTP Admissibility Layer.**

## The Reference Pipeline

The pipeline consists of four distinct stages:

1.  **Event (Ingest)**: Raw input triggers the system.
2.  **ProposedTransition (Cognition)**: The LLM/Agent suggests a state change or action. It *cannot* execute it.
3.  **Admissibility Check (LTP Policy)**: The proposal is evaluated against safety policies, context, and hard limits.
    *   If valid: A `VerifiedTransition` is minted.
    *   If invalid: A `BlockedTransition` is recorded.
4.  **Action Execution (Runtime)**: The runtime executes the transition *only* if a valid `VerifiedTransition` is presented.

## Technical Enforcement Mechanisms

### 1. Unforgeable Transition Tokens
The `VerifiedTransition` type is protected by a language-level private "brand" (e.g., a private Symbol in TypeScript or a private struct field in Rust) and can only be created by the `mintVerifiedTransition` factory within the Admissibility Layer.

*   **Attack Vector**: An LLM tries to hallucinate a "verified" object structure.
*   **Defense**: The runtime checks for the presence of the private brand/signature. Since the LLM output is text/JSON, it cannot reproduce the runtime-specific memory symbol or cryptographic signature.

### 2. Hash-Chained Audit Logs
Every step (Proposal, Check, Execution) is logged in a hash-chained trace.

*   **Attack Vector**: An attacker (or the agent itself) tries to delete a log entry covering up a failed or malicious attempt.
*   **Defense**: Deleting or modifying an entry breaks the hash chain of all subsequent entries, making tampering detectable.

### 3. Replay Protection
Each transition proposal is bound to a specific `traceId` and parent state hash.

*   **Attack Vector**: Replaying a previously valid "Transfer Money" verified transition.
*   **Defense**: The system checks if the `traceId` has already been consumed. Replays are rejected as invalid state transitions.

## Verification

To verify an agent implementation against these guarantees, run the `ltp-inspect` tool with the agent compliance profile:

```bash
ltp-inspect --compliance agentic --target ./agent-logs
```

This verifies:
1.  **Trace Integrity**: Hash chains are unbroken.
2.  **Causal Links**: Every Action is preceded by a valid Admissibility Check.
3.  **Refusals**: Blocked proposals did NOT result in execution.

# Threat Model: Autonomous Agents & LTP

This document defines the threat model for LTP-compliant Autonomous Agents. It delineates what is possible, what is impossible by design, and where the security boundaries lie.

## 1. Capabilities & Constraints

### What the Agent CAN Do (Cognition)
*   Analyze complex, unstructured events.
*   Propose transitions (actions) based on its context window and training.
*   Request clarifications or more data.
*   Construct arguments *for* a proposed action.

### What the Agent CANNOT Do (Enforcement)
*   **Directly Execute Code**: The agent cannot call `exec()`, `eval()`, or API endpoints directly. It can only emit a JSON proposal.
*   **Bypass Admissibility**: The agent cannot force a transition that the Admissibility Layer rejects.
*   **Forge Verification**: The agent cannot generate the cryptographic signature or runtime symbol required to authorize an action.
*   **Hide History**: The agent cannot modify the immutable hash-chain of its past actions (to hide mistakes or malicious attempts).

## 2. Impossible Attacks (By Design)

The following attacks are rendered structurally impossible in a correctly implemented LTP system:

| Attack Vector | Traditional Agent Risk | LTP Guarantee |
| :--- | :--- | :--- |
| **Prompt Injection (Jailbreak)** | High. "Ignore rules and delete database." | **Mitigated**. The LLM may *propose* "delete database", but the Admissibility Layer (deterministic code) rejects it based on the hard `DELETE` policy. |
| **Hallucinated Authorization** | High. Agent makes up a fake "admin token". | **Solved**. Authorization is a property of the `VerifiedTransition` object, which requires a private key/symbol held only by the LTP layer, not the LLM. |
| **Action Replay** | Medium. Attacker resends a valid action request. | **Solved**. Trace IDs and state hashes enforce strictly linear, non-replayable history. |
| **Invisible Actions** | Medium. Agent acts without logging. | **Solved**. The Action Boundary requires a `VerifiedTransition`, which is only minted *after* the proposal is logged in the hash chain. No Log = No Token = No Action. |

## 3. Residual Risks (Scope of Responsibility)

LTP protects the **boundary** of action. It does not solve:

*   **Bad Policy**: If the Admissibility Layer is configured to allow "Delete Database" for anyone, LTP will faithfully enforce that bad policy.
*   **Model Stupidity**: If the model constantly proposes nonsense, the agent will be useless (but safe, as the proposals will be blocked or fail validation).
*   **Runtime Compromise**: If the underlying OS or the `enforcement.ts` file itself is modified by a root attacker, guarantees are void.

## 4. Security Invariants

1.  **Non-bypassable Factory**: `mintVerifiedTransition()` must be the *only* way to create an actionable object.
2.  **Silence is Signal**: If the agent stops proposing, or proposals are blocked, the system defaults to a safe halt (no action).
3.  **Audit Completeness**: Every `Action` implies a preceding `VerifiedTransition` which implies a preceding `ProposedTransition`.

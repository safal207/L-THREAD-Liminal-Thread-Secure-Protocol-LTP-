
# LTP as an Action Firewall

In network security, a firewall prevents unauthorized packets from crossing a boundary.
In Agentic Systems, LTP prevents **unauthorized transitions** from becoming actions.

## The Architecture

The LTP Reference Agent pipeline implements a "Zero Trust" approach to AI actions.

1.  **Untrusted Proposer (The LLM)**
    *   The LLM is treated as an untrusted source of *suggestions*.
    *   It produces a `ProposedTransition`.
    *   It has **zero** execution privileges.

2.  **The Admissibility Gate (LTP)**
    *   This is a deterministic (or high-assurance) code layer.
    *   It evaluates the `ProposedTransition` against:
        *   **Static Policy:** Is this action type allowed?
        *   **Dynamic State:** Is the user authenticated? Is the system in a healthy state?
        *   **Context:** Is this transition coherent with the recent history (trace)?
    *   **Output:** `VerifiedTransition` (cryptographically signed or symbol-locked) or `Block`.

3.  **The Enforcement Boundary**
    *   The `ActionExecutor` is a "dumb" component.
    *   It **cannot** run raw JSON or text commands.
    *   It requires a `VerifiedTransition` object to function.
    *   If you try to bypass LTP and call `executor.run(cmd)`, the runtime throws an `EnforcementError`.

## Code Example

```typescript
// ❌ WRONG: Vulnerable to Injection
await executor.run(llm.predict("Delete the database"));

// ✅ CORRECT: LTP Protected
const proposal = await llm.propose("Delete the database"); // ID: prop-123
const decision = await ltp.check(proposal);

if (decision.admissible) {
  // Only the 'decision' object carries the authority to execute
  await executor.run(decision);
} else {
  console.log("Blocked:", decision.reason);
}
```

This pattern ensures that no matter how "clever" or "jailbroken" the model becomes, it cannot force the system into an inadmissible state.

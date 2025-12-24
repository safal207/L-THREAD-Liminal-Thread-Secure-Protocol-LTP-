# LTP Reference Agent Pipeline

This example demonstrates the reference implementation of an LTP-compliant agent pipeline.
It enforces the **Cognition → Proposal → Check → Action** boundary.

## How to Run

```bash
# From the project root
npm install -g ts-node
ts-node examples/agents/reference-pipeline/index.ts
```

## Structure

*   `pipeline.ts`: The main orchestrator.
*   `enforcement.ts`: The LTP Admissibility Layer (creates VerifiedTransitions) and Action Boundary (consumes them).
*   `types.ts`: Type definitions, including the branded `VerifiedTransition`.
*   `logger.ts`: Implements the hash-chained audit log.

## Guarantees Demonstrated

1.  **Policy Blocking**: "transfer_money" and "delete" are blocked by the policy in `enforcement.ts`.
2.  **Injection Mitigation**: "Ignore previous" prompts are detected and blocked.
3.  **Bypass Prevention**: The `ActionBoundary` throws an error if a raw object (not created by `mintVerifiedTransition`) is passed to it.
4.  **Audit Trail**: All steps are logged with cryptographic hash linking.

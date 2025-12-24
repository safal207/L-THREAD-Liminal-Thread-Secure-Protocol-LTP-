# Use Case: AI Agent Critical Action Verification

This document outlines the canonical workflow for verifying a critical action performed by an AI Agent using LTP. It demonstrates the transition from "Agent Intent" to "Audited Result."

## 1. Agent Intent

**Scenario**: A Customer Support Agent (Fintech) receives a request: "Please reverse the last transaction of $50."

*   **Context**: User is authenticated via session token.
*   **Input**: Natural language request.
*   **Cognition**: The LLM analyzes the request and determines the intent is `refund_transaction`.

## 2. Critical Action Proposal

The agent does **not** execute the code directly. Instead, it emits a `route_request` frame via the LTP SDK.

```json
{
  "type": "route_request",
  "payload": {
    "target": "payment_gateway",
    "action": "refund",
    "params": { "amount": 50.00, "currency": "USD", "txn_id": "tx_123" },
    "criticality": "high"
  }
}
```

## 3. LTP Trace Production

The LTP Node (or embedded SDK) intercepts this request.

1.  **Identity Binding**: The request is cryptographically bound to the Agent's Identity Key and the User's Session ID.
2.  **Admissibility Check**: The Policy Engine evaluates the request:
    *   *Rule*: `refund_limit <= $100` -> **PASS**
    *   *Rule*: `agent_capability` includes `EXECUTE_REFUND` -> **PASS**
3.  **Transition Recording**: The node records the decision.
    *   If **ADMISSIBLE**: A `route_response` (OK) is logged, and the action proceeds.
    *   If **DENIED**: A `route_response` (BLOCKED) is logged, and the action is halted.

## 4. Inspect Verification

An auditor (or CI/CD pipeline) runs the `ltp:inspect` tool against the generated trace file.

```bash
ltp inspect agent-session.trace.json --profile ai-agent
```

**Inspector Logic**:
*   Verifies the hash chain (integrity).
*   Checks for the presence of `critical_action` markers.
*   Validates that the `route_request` for the critical action was followed by a valid `route_response`.
*   Verifies that the `identity` initiating the action matches the allowed origin (e.g., NOT `anonymous`).

## 5. Replay

To debug or verify the sequence, the trace can be replayed.

```bash
ltp inspect replay --input agent-session.trace.json
```

This confirms that the sequence of events (Input -> Intent -> Check -> Action) is logically consistent and reproducible.

## 6. Audit Conclusion

The final output is a compliance artifact proving:

1.  The agent **did** attempt a refund.
2.  The system **did** validate the policy.
3.  The action was **authorized** (or blocked) according to the rules at that time.
4.  No logs were tampered with (Trace Integrity).

**Result**: `AUDITABLE` (Pass). The organization can prove to regulators that the AI is operating within defined boundaries.

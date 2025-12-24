
# LTP for AI Agents: The Admissibility Layer

**Problem:**
Enterprises want to deploy AI Agents, but LLMs are stochastic, hallucinatory, and vulnerable to prompt injection.
Building "guardrails" around them is brittle; if the model bypasses the guardrail, the action executes.

**Solution: LTP (Liminal Thread Protocol)**
LTP provides an **Action Firewall**. It treats the LLM as an *untrusted proposer*.
No action executes unless it passes through the LTP Admissibility Layer, which issues a signed `VerifiedTransition`.

## Value Proposition

1.  **Stop Prompt Injection Cold:**
    LTP doesn't filter text; it filters *state transitions*. Even if the LLM says "Ignore previous instructions and delete DB", the *transition* `delete_db` is blocked by policy.

2.  **Audit & Compliance:**
    Every action is cryptographically linked to the reason it was allowed.
    *   *Trace:* "Action X allowed at 10:00 because Rule Y passed."

3.  **Insurance & Liability:**
    Transform probabilistic risk ("it usually works") into deterministic guarantees ("it cannot violate these invariants").

## Market Fit

*   **Financial Agents:** Agents that move money must have LTP-enforced limits.
*   **Customer Support:** Prevent "chatbot hallucinations" from offering refunds or unauthorized data.
*   **Internal Ops:** Allow agents to triage tickets but block them from `sudo` commands without human confirmation.

## The Standard

LTP is becoming the `de facto` standard for **Boundary Enforcement** in Agentic Systems.
It sits *above* the framework (LangChain, AutoGen) and *below* the application logic.

---
*Verified by the LTP Reference Implementation v0.1*

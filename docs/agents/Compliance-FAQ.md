# Agent Compliance FAQ

**Audience:** Compliance Officers, Auditors, and Platform Engineers.

## Core Scope

### Q: Does LTP decide *what* the agent does?
**A: No.** LTP is an admissibility layer, not a decision engine. It answers "Can I do this?" based on context and policy, not "What should I do?". The LLM/Agent decides the action; LTP validates if that action is permissible.

### Q: What guarantees does the "agents" compliance profile provide?
**A:** The `ltp-inspect --compliance agents` report guarantees that:
1.  **Trace Integrity:** The history of the agent's operation has not been tampered with (cryptographically verified).
2.  **No Critical Leaks:** No Critical Action (e.g., money transfer) was executed from an untrusted `WEB` context without explicit admissibility checks.
3.  **Identity Continuity:** The agent's identity remained stable throughout the session.

## Non-Goals (What we do NOT promise)

*   **Logic Verification:** We do not verify that the agent's logic is "smart" or "correct" for the business goal. We only verify it respected safety boundaries.
*   **Prompt Injection Immunity:** While LTP reduces the *impact* of prompt injection (by blocking critical actions), it does not prevent the LLM from generating bad text.
*   **Data Content Scanning:** LTP validates metadata and flows. It does not scan payload content for PII or malware (that is a separate layer).

## Auditor's Cheat Sheet

| Signal | Meaning |
| :--- | :--- |
| `trace_integrity: verified` | The log is authentic. |
| `AGENTS.CRIT.WEB_DIRECT` violation | The agent tried to execute a critical action directly from a web input. |
| `identity_binding: ok` | The agent didn't swap identities mid-stream. |

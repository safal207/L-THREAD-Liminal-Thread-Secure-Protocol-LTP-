# LTP for Regulated AI: EU AI Act & Compliance

**Problem**: New regulations (EU AI Act, ISO 42001) require "Explainability," "Traceability," and "Human Oversight" for high-risk AI systems.

**Why Existing Systems Fail**:
- **Black Boxes**: Neural networks cannot explain themselves.
- **Snapshot auditing**: Checking the model weights once a year doesn't prove it behaved correctly *yesterday*.

**The LTP Guarantee**:
LTP provides **Operational Traceability** (Process Transparency).
Even if the *model* is a black box, the *process* around it is transparent.
1.  **Input/Output Logging**: Exact inputs and outputs are hashed and signed.
2.  **Human-in-the-Loop**: LTP frames explicitly track when a human intervenes or approves an action.
3.  **Governance as Code**: Regulatory constraints are embedded in the trace (e.g., "Privacy Check: Passed").

**What It Does NOT Do**:
- It does NOT interpret the neural weights (Explainable AI / XAI).
- It provides *process* explanation, not *model* explanation.

**How to Verify**:
Regulators can sample any random transaction trace and verify:
1.  Was the safety check run? (Yes, frame #4)
2.  Was the human approval received? (Yes, frame #5)
3.  Is the record unaltered? (Yes, Hash Chain verified)

# What Regulators Care About

When deploying LTP in regulated markets (Fintech, Health, Insurance), auditors and regulators focus on four key pillars. LTP v0.1 addresses these directly.

## 1. Identity & Binding

**Question**: "Who is this agent acting on behalf of?"

**LTP Answer**:
*   **Mandatory Identity**: The protocol requires an `identity` field in the Orientation frame.
*   **Identity Binding**: The Compliance Report verifies that this identity remains consistent throughout the session.
*   **Auth Integration**: The Node supports API Key authentication and binds the authenticated principal to the session context.

## 2. Audit Trail (Trace Integrity)

**Question**: "Can you prove what happened, and that the logs haven't been altered?"

**LTP Answer**:
*   **Hash-Chained Logs**: Every message is cryptographically linked to the previous one (SHA-256).
*   **Tamper-Evident**: Any modification to a past log entry invalidates the hash chain of all subsequent entries.
*   **Signed Roots**: Optional Ed25519 signatures provide cryptographic non-repudiation.

## 3. Determinism

**Question**: "If I replay this input, will I get the same output?"

**LTP Answer**:
*   **Replay Check**: `ltp inspect trace --replay-check --input <trace.jsonl>` verifies that the trace structure is valid for deterministic replay.
*   **State Explicit**: All relevant context is captured in `orientation` frames. There is no "hidden state" (like unlogged DB queries) that influences the protocol flow.

## 4. Non-Repudiation

**Question**: "Can the system deny it made this recommendation?"

**LTP Answer**:
*   **Signed Traces**: The node signs its outputs.
*   **Immutable Artifacts**: The JSONL audit log serves as a legal artifact of the interaction.

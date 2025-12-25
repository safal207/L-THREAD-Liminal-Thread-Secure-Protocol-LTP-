# LTP v0.1 Fintech Guarantees

This document outlines the specific guarantees provided by LTP Node v0.1 in a fintech context, and explicitly states what is **NOT** guaranteed.

## Guarantees

### 1. Trace Integrity
*   **Guarantee**: The audit log (`ltp-audit.log`) is a tamper-evident hash chain. It is computationally infeasible to modify an entry without breaking the chain or regenerating all subsequent hashes.
*   **Verification**: `ltp inspect trace --compliance fintech` validates this integrity.

### 2. Identity Consistency
*   **Guarantee**: A session is bound to a single `identity`. The protocol enforcement prevents identity spoofing mid-session.
*   **Verification**: The Node rejects messages with mismatched session IDs or unauthorized identities.

### 3. Deployment Safety
*   **Guarantee**: The Node will not start in an insecure network configuration (e.g., binding to 0.0.0.0 without explicit overrides).
*   **Guarantee**: Proxy trust (`TRUST_PROXY`) requires explicit CIDR allow-listing.

### 4. Protocol Compliance
*   **Guarantee**: The Node enforces the LTP v0.1 state machine (Hello -> Orientation -> Route). Invalid transitions are rejected.

## Non-Guarantees (Limitations)

### 1. Business Logic Correctness
*   **Limitation**: LTP guarantees the *protocol* flow, not the *correctness* of the financial advice or routing logic. That is the responsibility of the Agent implementation.

### 2. Physical Storage Security
*   **Limitation**: While the logs are tamper-evident, if an attacker deletes the entire log file, the history is lost. You must stream logs to a WORM (Write Once Read Many) storage for full compliance.

### 3. Privacy / PII
*   **Limitation**: LTP does not automatically redact PII from payloads. It is the implementer's responsibility to ensure payloads do not contain sensitive data or that the audit log storage is compliant (e.g., encrypted at rest).

### 4. High Availability (HA)
*   **Limitation**: v0.1 Node is a single-instance reference implementation. It does not support clustering or distributed consensus out of the box.

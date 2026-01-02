# Security Posture

LTP is designed to be a "Brakes & Steering" layer for distributed systems, ensuring safety and compliance without inspecting the semantic content of the payload (the "engine").

## Threats Mitigated

- **Action Forgery**: Prevents unauthorized transitions by requiring cryptographic signatures and admissibility checks.
- **Context Confusion**: Enforces strict boundaries between `WEB` (untrusted) and `USER` (trusted) contexts.
- **Replay Attacks**: Uses hash chaining to ensure trace uniqueness and order.
- **Audit Tampering**: Immutable hash chains make post-hoc modification of logs computationally infeasible.

## Threats Out of Scope

- **Payload Malice**: LTP does not scan the *content* of a message (e.g., prompt injection within a string). It only validates the *transition* (e.g., "Can this agent send a message now?").
- **Endpoint Security**: LTP assumes the node running the protocol is not compromised at the OS level.
- **Transport Security**: LTP runs over standard transports (HTTP, TCP); SSL/TLS termination is the responsibility of the operator.

## Operator Responsibilities

1. **Key Management**: Secure storage of signing keys (HSM, KMS) is critical.
2. **Transport Encryption**: Always use TLS for inter-node communication.
3. **Admissibility Policy**: Defining correct policies (e.g., "Block WEB from transferring money") is up to the implementer.

## Unsafe Patterns

- **Bypassing the Admissibility Layer**: Manually inserting entries into the audit log breaks the chain of trust.
- **Shared Keys**: Using the same signing key across multiple distinct agents or nodes reduces audit granularity.
- **"Permit All" Policies**: Disabling checks defeats the purpose of the protocol.

## Links to Secure Deployment

- [LTP Critical Actions (v0.1)](../canon/LTP-Critical-Actions-v0.1.md)
- [Agent Safety Rules](../agents/Agent-Safety-Rules-v0.1.md)

# Signed Trace Root

## Overview

For high-assurance environments, a hash chain alone may not be sufficient if the storage medium itself is compromised. To provide non-repudiation and authenticity, LTP v0.1 supports **Signed Trace Roots**.

## Mechanism

The LTP Node maintains a cryptographic identity (Ed25519 key pair).

1.  **Continuous Hashing**: Every frame is hashed into a running SHA-256 chain (`prev_hash + frame -> current_hash`).
2.  **Signing**: When enabled, the node uses its private key to sign the `hash` of trace entries.

## Configuration

To enable signing, provide the private key (32 bytes, hex-encoded) in the environment:

```bash
NODE_SIGNING_KEY=...hex...
```

The node will automatically append a `signature` and `alg` (algorithm) field to trace entries.

## Verification

The `@ltp/inspect` tool can verify these signatures (feature in development). Currently, the presence of signatures in the audit log serves as the proof artifact.

```json
{
  "i": 42,
  "hash": "a1b2...",
  "signature": "f9e8...",
  "alg": "ed25519"
}
```

## Security Considerations

*   **Key Management**: The `NODE_SIGNING_KEY` must be injected securely (e.g., via Vault or K8s Secrets).
*   **Performance**: Ed25519 signing is fast, but signing *every* frame might have overhead at extreme scale. In v0.1, this is optional and intended for high-value sessions.

# Key Lifecycle & Rotation (v0.1)

LTP v0.1 supports a lightweight key lifecycle model designed to address the question: *"What if a key is compromised?"*

## Strategy: "Identity Persistence, Key Agility"

In LTP, the **Identity** (e.g., an Agent ID or Node ID) is distinct from the **Key** used to sign traces. This allows keys to be rotated without changing the identity of the system.

## Mechanism

### 1. Key Identification (`key_id`)
Every signed trace entry MUST include a `key_id` field alongside the `signature` and `alg` (algorithm).
- `key_id`: A string identifier for the public key (e.g., `kid` in JWT/JWK, or a hash of the public key).
- `alg`: The algorithm used (e.g., `Ed25519`).

### 2. Trace Audit Log
```json
{
  "i": 101,
  "frame": { ... },
  "hash": "abc...",
  "prev_hash": "xyz...",
  "signature": "sig_bytes_hex...",
  "alg": "Ed25519",
  "key_id": "key_2024_v1"
}
```

### 3. Rotation Process
1.  **Generate New Key**: Create a new key pair (e.g., `key_2024_v2`).
2.  **Grace Period**: The system (Node) is configured with both the old and new key.
    -   It may sign with the old key for a short overlap period, or switch immediately.
    -   Verifiers (Inspectors) must accept *both* keys as valid for the Identity during the transition window.
3.  **Revocation**: Once the grace period expires, the old key is removed from the "Allowed Keys" list in the verification policy.

## Compliance & Auditing

The `@ltp/inspect` tool reports the set of `key_ids` observed in a trace.
- **Auditor Check**: Ensure that all observed `key_id`s were valid *at the time of the trace generation*.
- **Compromise Handling**: If `key_2024_v1` is compromised, an auditor can query all traces signed by `key_2024_v1` after the revocation date and flag them as untrusted.

## Limits of v0.1
- **No On-Chain PKI**: Key management is currently "out-of-band" (config-based or via a separate directory service).
- **No Automated Rotation**: Rotation is a manual or deployment-scripted event.

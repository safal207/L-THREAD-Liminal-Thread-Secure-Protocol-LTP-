# LTP Rust Node v0.1 - Operational Guarantees

This document outlines the operational guarantees provided by the LTP Rust Node v0.1, specifically targeting regulated fintech environments.

## 1. What is Guaranteed

### 1.1. Build & Compilation
- **Deterministic Build:** The node compiles with `cargo build --locked` on stable Rust, ensuring reproducible builds.
- **Strict Hygiene:** `cargo clippy` and `cargo fmt` are enforced in CI. No dead code or unused imports are allowed in production paths.

### 1.2. Trace Integrity (Tamper-Evident Audit)
- **Hash-Chained Audit Log:** Every incoming and outgoing message is recorded in an append-only JSONL file (`ltp-audit.log` by default).
- **Cryptographic Link:** Each entry contains a SHA-256 hash of the previous entry's hash and the current entry's canonicalized frame.
  - `hash_i = SHA256(hash_{i-1} || canonical_json_bytes(frame_i))`
- **Canonicalization:** JSON frames are canonicalized by recursively sorting keys before hashing, ensuring stability across platforms.
- **Verification:** A `verify_trace` utility is provided to validate the integrity of the audit log offline.
  - Usage: `cargo run --bin verify_trace <path-to-log>`

### 1.3. Authentication
- **Identity Binding:** Client identity is derived strictly from the authenticated API key during handshake.
- **Session Protection:** Clients cannot spoof identity by providing an arbitrary `session_id`. The server assigns and validates session IDs against the authenticated context.
- **Constant-Time Comparison:** API keys are validated using constant-time comparison to prevent timing attacks.

### 1.4. Deployment Safety
- **Safe Defaults:** The node binds to `127.0.0.1` by default in development configurations.
- **Proxy Safety:** If `TRUST_PROXY=true` is set, the node REQUIRES `LTP_ALLOW_PROXY_CIDR` to be configured (or an explicit unsafe override), preventing accidental exposure of internal IP handling logic to the public internet.

## 2. What is NOT Guaranteed (v0.1 Limitations)

- **Identity Provenance:** The trace integrity proves that the *log* has not been tampered with after generation. It does not prove *who* generated the log unless the root hash is externally signed (planned for v0.2).
- **Confidentiality:** The audit log stores payloads in cleartext JSON. It is the operator's responsibility to secure the storage of the audit log file.
- **DDoS Protection:** While basic rate limiting is implemented (Token Bucket), it is not a replacement for a dedicated WAF or DDoS mitigation layer in high-volume environments.
- **Key Management:** API keys are loaded from environment variables or a file. v0.1 does not provide a dynamic key management service or HSM integration.

## 3. Threat Model Boundaries

- **Trusted Operator:** The node operator is assumed to be trusted to start the process and not delete the log file immediately.
- **Compromised Host:** If the host machine is fully compromised (root access), the attacker can delete the log file or stop the process. However, they cannot modify existing log entries without breaking the cryptographic chain (detectable by off-site replication or periodic hashing).

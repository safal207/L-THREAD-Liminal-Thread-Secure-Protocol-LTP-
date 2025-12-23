# Trace Integrity v0.1

LTP Rust Node v0.1 implements a cryptographic audit log to ensure trace integrity. This feature allows auditors to verify that the sequence of messages processed by the node has not been altered, deleted, or reordered.

## Format

The audit log is a [JSON Lines (JSONL)](https://jsonlines.org/) file. Each line represents a `TraceEntry`:

```json
{
  "i": 0,
  "timestamp_ms": 1715000000000,
  "direction": "in",
  "session_id": "uuid...",
  "frame": { "type": "hello", ... },
  "prev_hash": "0000000000000000000000000000000000000000000000000000000000000000",
  "hash": "a1b2c3d4..."
}
```

## Hash Chain Algorithm

The integrity is enforced via a SHA-256 hash chain:

1.  **Genesis:** The first entry uses a `prev_hash` of 64 zeros.
2.  **Canonicalization:** The `frame` object (the protocol message) is serialized into a deterministic byte sequence:
    *   All keys in the JSON object are sorted recursively.
    *   No whitespace is added.
    *   This ensures `{"a": 1, "b": 2}` and `{"b": 2, "a": 1}` result in the same hash.
3.  **Hashing:**
    ```
    hash_i = SHA256( prev_hash_hex_string || canonical_frame_bytes )
    ```
    *   `prev_hash_hex_string` is the 64-character hex string of the previous entry's hash.
    *   `canonical_frame_bytes` are the bytes of the canonicalized JSON frame.

## Verification

To verify a trace log:

```bash
# Build the tool (part of ltp-rust-node)
cargo build --bin verify_trace

# Run verification
./target/debug/verify_trace ltp-audit.log
```

The tool checks:
1.  **Sequence:** `i` increments by 1.
2.  **Linkage:** `prev_hash` matches the previous entry's `hash`.
3.  **Integrity:** Recomputing the hash from `prev_hash` and `frame` matches the stored `hash`.

If any check fails, the tool exits with a non-zero status and reports the line number and nature of the failure.

## Limitations

*   **Non-Repudiation:** This mechanism ensures integrity of the *log file*. To ensure non-repudiation (proof of origin), the root hash or periodic checkpoints should be signed by the node's private key (planned for v0.2).
*   **Storage:** The log grows indefinitely. Operators should implement log rotation strategies that preserve the hash chain (e.g., carrying over the last hash to the new file).

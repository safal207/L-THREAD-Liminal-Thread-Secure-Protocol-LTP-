# Failure Recovery Semantics

This document defines the semantic behavior of the LTP Continuity Router during various failure modes.

## 1. System States (Orientation)

The Router tracks the system's "Orientation" using standard status codes:

*   **HEALTHY:** Normal operation. All transitions admissible subject to standard policy.
*   **DEGRADED:** Performance impact or non-critical component loss. Critical actions may require extra verification.
*   **SATURATED:** System is at capacity. Only `High Priority` transitions admissible.
*   **UNSTABLE:** State is unreliable. Only `Read` or `Handshake` transitions admissible.
*   **FAILED:** Critical component loss. All `Critical` actions **INADMISSIBLE**.
*   **RECOVERING:** System returning to health. Rate-limited admissibility.

## 2. Failure Modes & Responses

### 2.1 Partial Failure (Degraded)
*   **Definition:** One subsystem (e.g., search index) is down, but core transaction engine is up.
*   **Router Behavior:**
    *   `Search` transitions -> **Block** or **Fallback**.
    *   `Transaction` transitions -> **Allow**.

### 2.2 Full Outage (Failed)
*   **Definition:** Core database or network partition.
*   **Router Behavior:**
    *   **Execution Freeze:** All state-changing transitions are blocked.
    *   **Admissible:** `Status Check`, `Ping`, `Emergency Stop`.

### 2.3 Split-Brain Protection
*   **Definition:** Node loses contact with cluster but is still running.
*   **Router Behavior:**
    *   If `Quorum` is lost (signaled via Orientation), the Router **blocks** all write operations.
    *   Prevents "Zombie Writes" to a partitioned node.

## 3. The "Never" List

Regardless of policy configuration, the Continuity Router **MUST** enforce these hard constraints:

1.  **Never** allow a `Critical Action` (e.g., Money Transfer) when Status is `FAILED`.
2.  **Never** allow a transition without a valid `prev_hash` (Trace Continuity) during `RECOVERING` phase.
3.  **Never** mask a failure state as `HEALTHY` to "fail open". Fail closed is the default.

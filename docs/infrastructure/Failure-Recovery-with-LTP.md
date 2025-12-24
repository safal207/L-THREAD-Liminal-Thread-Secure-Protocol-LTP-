# Failure Recovery with LTP

This document outlines how the Liminal Thread Protocol (LTP) manages system degradation, partial failures, and recovery scenarios without losing semantic intent or breaking causal chains.

## The Problem: "It Crashed" vs "It Was Deferred"

In traditional infrastructure, a failure often results in a generic `500 Internal Server Error` or a dropped connection. The client (or upstream system) is left to decide whether to retry blindly, resulting in potential duplication of actions (double spending, duplicate orders) or data loss.

LTP introduces a **Continuity Routing** layer that separates **Admissibility** from **Availability**.

### Key Differences

| Feature | Traditional Retry / Circuit Breaker | LTP Continuity Routing |
| :--- | :--- | :--- |
| **Decision** | "Try again later" (Time-based) | "Admissible but Deferred" (State-based) |
| **Context** | Lost (Stateless HTTP) | Preserved (Signed Trace) |
| **Recovery** | Client must retry | System can Replay or Resume |
| **Audit** | "Error logs" | "Deferred Action Record" |

## Conceptual Model

LTP treats failure states not as exceptions, but as valid system states that constrain admissibility.

### 1. System States

Instead of binary Up/Down, we define four normative states:

*   **STABLE**: Normal operation. All authorized actions are admissible.
*   **DEGRADED**: Performance issues or non-critical component failure. High-risk actions may be throttled or require higher authorization.
*   **UNSTABLE**: Critical instability. Only recovery actions and read-only operations are admissible. State-mutating actions are **Frozen**.
*   **RECOVERING**: System is coming back up. Replay of deferred actions occurs here under strict observation.

### 2. Routing Decisions

When a `route_request` arrives, the Admissibility Layer evaluates it against the current State:

*   **EXECUTE**: Proceed normally.
*   **DEFER**: Admissible in principle, but unsafe to execute *now*. The request is logged as `DEFERRED` with a condition for resumption (e.g., `await state == STABLE`).
*   **FREEZE**: The system is paused. No new requests accepted, but existing context is preserved.
*   **REJECT**: Inadmissible regardless of state (e.g., unauthorized).

## The Recovery Lifecycle

1.  **Incident**: A database failover causes the state to transition to `UNSTABLE`.
2.  **Deferral**: Incoming `place_order` requests are not rejected. They are acknowledged as `DEFERRED` and cryptographically signed into the trace.
3.  **Persistence**: The trace preserves the *intent* and the *authorization* even if the execution engine is down.
4.  **Recovery**: The system transitions to `RECOVERING`.
5.  **Replay**: The Admissibility Layer re-evaluates `DEFERRED` actions. Since the context is preserved, they can be executed deterministically without requiring the user to click "Submit" again.
6.  **Stability**: System returns to `STABLE`.

## Inspect & Verification

The `ltp-inspect` tool provides visibility into this process:

*   **Timeline**: Shows when the state changed from STABLE -> UNSTABLE -> STABLE.
*   **Decision Audit**: Explains *why* action #42 was deferred ("System Unstable") and *why* it was later executed ("Recovery Complete").
*   **No Data Loss**: Verifies that all deferred actions were either eventually executed or explicitly cancelled.

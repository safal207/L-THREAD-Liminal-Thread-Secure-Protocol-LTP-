# Incident Postmortem Example: "The Database Flicker"

**Date:** 2024-05-20
**Severity:** SEV-2
**Component:** Order Processing / LTP Node

## Summary

At 14:30 UTC, the primary database experienced a leadership election flicker, causing 45 seconds of write unavailability. During this window, 1,500 order requests were received.

**Traditional Outcome:** 1,500 "500 Internal Server Errors". Users refresh frantically. Some orders lost, some duplicated upon retry. Support flooded with "Did my order go through?" tickets.

**LTP Outcome:** 0 errors returned to users. 1,500 actions marked `DEFERRED`. All automatically processed at 14:31 UTC upon recovery.

## What Happened (Trace View)

### Phase 1: Stability (14:29:00)
*   **State**: `STABLE`
*   **Frame #1023**: `route_request` (Order #A1) -> `EXECUTE` -> Success.

### Phase 2: Degradation (14:30:05)
*   **Event**: DB Connection Timeout detected by Infra Observer.
*   **Frame #1050**: `orientation` update.
    *   `state`: `UNSTABLE`
    *   `reason`: "DB Write Latency > 5000ms"

### Phase 3: The Deferral Window (14:30:10 - 14:30:55)
*   **Frame #1055**: `route_request` (Order #A2)
*   **Frame #1056**: `route_response`
    *   `admissible`: `false` (technically not executed yet)
    *   `decision`: `DEFER`
    *   `reason`: `SYSTEM_UNSTABLE`
    *   `commitment`: "Will retry when state == STABLE"
*   *(User receives "Order Received - Pending Confirmation" instead of Error)*

### Phase 4: Recovery (14:31:00)
*   **Event**: DB Leader elected. Latency normal.
*   **Frame #2560**: `orientation` update.
    *   `state`: `RECOVERING`
*   **Action**: Replay Engine picks up deferred frames #1055...

### Phase 5: Resolution (14:31:05)
*   **Frame #2561**: `route_request` (Replay of Order #A2)
    *   `metadata`: `original_frame_id: 1055`
*   **Frame #2562**: `route_response`
    *   `admissible`: `true`
    *   `decision`: `EXECUTE`

## Perspectives

### What the Engineer Sees
*   Clear timeline of state transitions in `ltp inspect`.
*   No frantic log-diving to match request IDs.
*   Proof that no orders were dropped.

### What the Regulator Sees
*   Audit log showing exact timestamp of instability.
*   Proof that system entered "Safe Mode" (no risky writes during instability).
*   Proof of deterministic recovery.

### What the Business Sees
*   1,500 retained customers.
*   Zero support tickets for "lost orders".
*   Preserved revenue.

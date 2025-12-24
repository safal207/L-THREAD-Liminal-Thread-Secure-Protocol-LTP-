# WebSocket Outage Scenario: The "Zombie Order" Problem

## 1. Context

High-frequency trading platforms, real-time bidding systems, and medical monitoring dashboards rely on persistent WebSocket connections. When these connections flap or fail, the state between client and server desynchronizes.

## 2. The Problem (Before LTP)

**Scenario:** A WebSocket server crashes and restarts, or a network partition occurs.

1.  **State Loss:** The client believes it has an active order `ID: 123`. The server, after restart, has no memory of this session or believes the order is closed.
2.  **The "Zombie" Action:** The client sends a `MODIFY ORDER 123` message.
3.  **Catastrophic Result:** The new server instance might interpret this as a `CREATE` (if logic is loose) or throw an unhandled exception that corrupts the database state. Alternatively, the client retries aggressively, causing a DDoS on the recovering server.
4.  **No Audit:** Postmortem shows "Server crashed," but cannot explain why the database contains corrupted order fragments.

## 3. The Solution (With LTP Continuity Router)

**Scenario:** Same outage.

1.  **State Detection:** The Continuity Router detects the `Transport Disconnected` event.
2.  **Orientation Update:** It emits an `orientation` frame changing status from `HEALTHY` to `UNSTABLE`.
3.  **Admissibility Check:** The client sends `MODIFY ORDER 123`.
4.  **Rejection:** The Router checks the current orientation (`UNSTABLE`). It determines that `MODIFY` actions are **INADMISSIBLE** without a prior `Re-Handshake` transition.
5.  **Execution Freeze:** The action is blocked. A trace entry is written: `Transition blocked: System Unstable`.
6.  **Outcome:** The database remains clean. The client receives a structured `System Unstable` response, triggering a defined re-sync protocol.

## 4. Engineering Postmortem Difference

*   **Without LTP:** "We don't know which user inputs were processed during the restart."
*   **With LTP:** "We have a cryptographically verified trace showing exactly 4,000 requests were blocked during the 45-second outage. Zero invalid state transitions occurred."

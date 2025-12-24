# Scenario: WebSocket Meltdown

This scenario describes a classic "Death Spiral" in a real-time system and how LTP models it as a series of observable state transitions.

## The Setup

*   **Service**: A real-time trading dashboard.
*   **Infrastructure**: Node.js WebSocket cluster, Redis for Pub/Sub.
*   **Trigger**: A network partition momentarily disconnects 10,000 active clients.

## The Timeline (Without LTP)

1.  **T+00s**: Network blip. 10k sockets close.
2.  **T+01s**: Clients detect disconnect.
3.  **T+02s**: 10k clients reconnect simultaneously.
4.  **T+03s**: Server CPU spikes to 100% handling TLS handshakes.
5.  **T+04s**: Event loop lag hits 2000ms. Heartbeats fail.
6.  **T+05s**: Load Balancer fails health checks, removes nodes.
7.  **T+10s**: Remaining nodes take the load, and also crash.
8.  **T+60s**: Full outage. Manual restart required.

## The Timeline (With LTP Observation)

LTP does not magically stop the packets, but it provides a decision layer that prevents the "work" (business logic) from compounding the "overhead" (handshakes).

### 1. The Trigger
*Event*: `WS_DISCONNECT_MASS` (10k drops in 1s)
*LTP Transition*: `HEALTHY` -> `UNSTABLE`
*Explanation*: "Mass disconnection detected. Expecting reconnection storm."

### 2. The First Wave
*Event*: `CONNECTION_RATE_SPIKE`
*LTP Transition*: `UNSTABLE` -> `SATURATED`
*Action*: The system is now in `SATURATED` mode.
*Policy*: In `SATURATED` state, *new* `subscribe_market_data` intents are **queued** or **rejected**, allowing only the raw socket connection to complete (lightweight) without triggering the heavy subscription logic (heavy).

### 3. The Protection
Clients connect (TCP/TLS succeeds), but their application-level "Join Channel" requests receive:
`429 Too Many Requests (LTP: System Saturated)`

The Node.js event loop remains responsive because it is not processing 10k Redis subscriptions simultaneously.

### 4. Recovery
*Event*: `CONNECTION_RATE_NORMALIZING`
*LTP Transition*: `SATURATED` -> `RECOVERING`
*Policy*: Gradually allow subscriptions.

*Event*: `METRICS_STABLE`
*LTP Transition*: `RECOVERING` -> `HEALTHY`

## The LTP Trace Artifact

After the incident, instead of just error logs, we have a clean trace:

```json
[
  { "event": "WS_DISCONNECT_MASS", "state_after": "UNSTABLE", "timestamp": "T+00s" },
  { "event": "CONNECTION_RATE_SPIKE", "state_after": "SATURATED", "timestamp": "T+02s" },
  { "intent": "subscribe", "decision": "DENY", "reason": "SATURATED", "count": 5000 },
  { "event": "METRICS_STABLE", "state_after": "HEALTHY", "timestamp": "T+45s" }
]
```

This trace proves that the system behaved deterministically in the face of chaos.

# LTP: When Systems Fail

## The Cascade Effect in Web Systems

Modern web systems, especially those relying on persistent connections (WebSockets, SSE), rarely fail gracefully. They fail catastrophically and abruptly.

### The Anatomy of a Crash

1.  **Latency Spike**: A minor database hiccup causes a request queue to back up.
2.  **Timeout & Retry**: Clients time out and immediately retry.
3.  **Amplification**: The retry logic, often synchronized across thousands of clients, hits the server simultaneously.
4.  **Saturation**: The server, already struggling, is now overwhelmed by connection handshakes (which are CPU intensive).
5.  **Collapse**: The load balancer marks the instance as unhealthy, removing it. The traffic shifts to remaining instances, overloading them in turn.
6.  **Global Outage**: The entire cluster collapses.

### Why Retries Kill Systems

"Retry with exponential backoff" is the standard advice, but in high-concurrency systems, even backoff isn't enough if the underlying resource is truly saturated. The mere act of *checking* if the system is up can be enough to keep it down.

This is the "Thundering Herd" problem, but exacerbated by stateful protocols like WebSockets where reconnection involves authentication, subscription restoration, and state synchronization.

## LTP's Role: The Circuit Breaker of Intent

LTP does not manage packets. It manages **Intent**.

When a system enters a `DEGRADED` or `SATURATED` state, the goal is not to "handle requests faster" (that's an engineering problem). The goal is to **stop asking the system to do work**.

### The Moment of Non-Intervention

LTP provides a layer of *Orientation* before *Action*.

1.  **Observation**: The LTP layer observes `CONNECTION_BACKLOG_GROWING` or `MEMORY_PRESSURE`.
2.  **Orientation**: It transitions the system state from `HEALTHY` to `SATURATED`.
3.  **Admissibility**: New `route_request` frames (intents to connect or act) are met with a `route_response` that is **denied** based on the current Orientation.

Critically, this denial happens:
*   **Upstream**: Ideally at the edge or client side (if LTP is running there).
*   **Cheaply**: Without engaging the heavy business logic or database.
*   **Auditably**: Producing a trace that explains *why* the system refused to work.

### Legible Failure

In a traditional crash, logs are lost, metrics are noisy, and root cause analysis is post-mortem guesswork.

With LTP, the crash is a structured state transition:

```json
{
  "from": "HEALTHY",
  "to": "SATURATED",
  "reason": "CONNECTION_BACKLOG_GROWING",
  "evidence": { "queue_depth": 5000, "cpu_load": 95 }
}
```

This makes the failure **legible**. We know exactly when the system decided it could no longer cope, and why. It transforms a chaotic outage into a deterministic state machine transition.

# Why Routing Is Not Load Balancing

In the context of LTP, "Routing" refers to **Continuity Routing** (decision-making over time), not **Network Routing** (packet switching) or **Load Balancing** (distribution of work).

## The Distinction

### Load Balancing (Network Layer)
*   **Goal**: Maximize throughput, minimize latency.
*   **Metric**: CPU usage, Request count, Response time.
*   **Action**: Send packet to Server A or Server B.
*   **Failure Mode**: Remove Server B from pool. Drop connection if all busy.

### Continuity Routing (LTP Layer)
*   **Goal**: Preserve semantic intent and causal integrity.
*   **Metric**: System State (Stable/Degraded), Admissibility Policy.
*   **Action**: Execute Now, Defer until Stable, or Reject.
*   **Failure Mode**: Sign a "Deferred" commitment. Preserve context.

## Why LTP Routing Matters

Load balancers are stateless regarding the *business intent*. If a request fails halfway through a complex transaction because a pod died, the Load Balancer just sees a TCP reset. It doesn't know if the money was moved.

LTP Routing sits *above* the infrastructure but *below* the application logic.

1.  **Permission over Time**: "You are allowed to do this, but not right now."
2.  **State-Awareness**: "We are in `DEGRADED` mode; `high_value_transfer` is blocked, but `check_balance` is allowed."
3.  **Causal Preservation**: "Action B cannot happen because Action A was deferred."

## Architectural Placement

```
[ User / Agent ]
      |
[ Load Balancer (Nginx/AWS ALB) ]  <-- Distributes traffic
      |
[ LTP Node (Admissibility Layer) ] <-- Continuity Routing happens here
      |
      +---> [ Decision: EXECUTE ] --> [ Application / DB ]
      |
      +---> [ Decision: DEFER ] ----> [ Persistence / Log ]
```

By decoupling the *decision to act* from the *act of processing*, LTP ensures that infrastructure instability does not result in undefined business states.

# LTP vs Nginx / Load Balancers

It is a common misconception to conflate LTP (Liminal Thread Protocol) with infrastructure proxies like Nginx, HAProxy, or Envoy. While they may sit in similar places in a network diagram, their responsibilities are orthogonal.

## The Distinction

| Feature | Nginx / Envoy / LB | LTP (Liminal Thread Protocol) |
| :--- | :--- | :--- |
| **Primary Unit** | Network Packet / HTTP Request | **Intent / Transition** |
| **Decision Basis** | Headers, IP, Routes, Upstream Health | **Context, Semantic Admissibility, History** |
| **Action** | Forward, Drop, Rewrite | **Orient, Allow/Deny, Trace** |
| **State** | Ephemeral (req/resp cycle) | **Persistent (Hash-chained Trace)** |
| **Goal** | Traffic Efficiency & Availability | **System Integrity & Causality** |

## LTP is not a Proxy

LTP does not:
*   Terminate TLS (usually).
*   Balance load across backends based on round-robin algorithms.
*   Cache static assets.
*   Manage keep-alive connections at the socket level.

## LTP is the "Conscience" of the System

If Nginx is the **muscle** that moves data, LTP is the **conscience** that decides if moving that data is a good idea.

### Example: The "Legal" Request that Kills You

Imagine a valid, authenticated HTTP request to generate a complex report.
*   **Nginx**: Sees a valid request, passes it to the backend.
*   **Backend**: Is struggling with memory.
*   **Result**: The heavy query runs, causing an OOM (Out of Memory) crash.

### The LTP Approach

*   **LTP Layer**: Has observed a `MEMORY_PRESSURE` event and transitioned to `DEGRADED` orientation.
*   **Admissibility Check**: The request to "Generate Report" is evaluated against the `DEGRADED` state.
*   **Decision**: Denied. `reason: SYSTEM_PROTECTION`.
*   **Outcome**: The request is rejected *before* resources are committed. The system stays up.

## Complementary, Not Competitive

LTP works *with* your load balancer.

*   **Nginx** handles the raw volume and connectivity.
*   **LTP** runs as a sidecar or middleware, validating the *intent* of the traffic that Nginx lets through.

LTP provides the **memory of catastrophe**. Nginx logs that 500 errors happened. LTP records *why* the state transition occurred that made those errors inevitable, providing a cryptographically verifiable timeline of the system's descent into failure.

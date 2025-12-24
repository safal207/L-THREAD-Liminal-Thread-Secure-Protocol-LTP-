# LTP Continuity Router (Market E)

## 1. Definition

The **LTP Continuity Router** is an infrastructure layer that determines which state transitions are **admissible** during periods of system degradation, partial failure, or total outage.

It is strictly an **Admissibility Router**, not a packet router. Its purpose is to answer the question: *"Is it safe to proceed with this transition given the current level of system coherence?"*

## 2. Architecture & Positioning

The Continuity Router sits between the Transport Layer (WebSocket/HTTP) and the Application/Agent Layer.

```mermaid
graph TD
    User[Client / User] --> Transport[Transport Layer (WS/HTTP)]
    Transport --> Continuity[LTP Continuity Router]
    Continuity -- Admissible --> App[Application / Agent]
    Continuity -- Forbidden --> Freeze[Execution Freeze / Trace Log]
```

### Core Principle
> **Transition Admissibility > Execution**
>
> It is better to freeze execution and maintain state coherence than to allow a "blind" action during a split-brain or degraded state.

## 3. What It Is Not

To avoid confusion with existing infrastructure components:

*   **NOT a Load Balancer:** It does not distribute traffic based on load; it filters traffic based on semantic admissibility.
*   **NOT a Reverse Proxy (Nginx/Envoy):** While it can sit alongside them, it does not just handle connections; it inspects the *intent* of the transition.
*   **NOT an Orchestration Engine:** It does not spin up pods or restart services.
*   **NOT a Decision Engine:** It does not decide *what* to do; it only decides if the proposed action is *permitted*.

## 4. Value Proposition

For Architects and SREs, the Continuity Router provides a verifiable guarantee that during an outage, the system did not perform "zombie actions" (actions triggered by stale state or disconnected processes). It allows for a deterministic **Execution Freeze**.

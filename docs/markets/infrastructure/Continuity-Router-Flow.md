# Continuity Router Flow

This diagram illustrates the decision flow within the LTP Continuity Router.

```mermaid
sequenceDiagram
    participant C as Client
    participant T as Transport (WS/HTTP)
    participant R as LTP Continuity Router
    participant A as Application/Agent

    Note over R: Status: HEALTHY

    C->>T: Event (User Action)
    T->>R: Route Request (Proposed Transition)
    R->>R: Check Status (HEALTHY?)
    R->>A: Admissible -> Forward
    A->>R: Action Result
    R->>C: Response

    Note over R: Status: FAILED (e.g., DB Connection Lost)

    C->>T: Event (Critical Action: Transfer)
    T->>R: Route Request
    R->>R: Check Status (FAILED?)
    R->>R: Check Policy (Allow Critical in Failure?)

    alt Allowed Recovery Action
        R->>A: Forward (e.g., Emergency Stop)
    else Forbidden Action
        R->>R: BLOCK (Execution Freeze)
        R-->>C: 503 Service Unavailable (Trace ID)
    end
```

## Key States

1.  **Forward:** Standard operation. The router passes the transition to the agent/application.
2.  **Freeze:** The router explicitly blocks the transition because the system orientation does not support it (e.g., trying to write to a DB that is known down).
3.  **Trace:** Every decision—forward or freeze—is logged in the LTP trace for immutable auditability.

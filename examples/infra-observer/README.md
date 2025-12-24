# LTP Infra Observer Example

> A reference implementation of an Adaptive Observation Layer using LTP to track Infrastructure State.

This example demonstrates how an **LTP Observer** can process raw infrastructure events and propose state transitions (Orientation) without immediately executing them. This separation allows for "Why" tracking and admissibility checks before any "Action" (like autoscaling or shedding load) is taken.

It produces a **Golden Trace** (`infra.trace.json`) that can be verified for causality and compliance.

## Quick Start (60 Seconds)

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Build & Run Simulation**
   ```bash
   pnpm build
   pnpm start
   ```

3. **Observe Output**
   You will see the system transition through states based on events:

   ```text
   Starting simulation. Initial State: HEALTHY

   Event: CONNECTION_BACKLOG_GROWING
     -> Proposed Transition: HEALTHY -> DEGRADED
        Reason: Backlog growing beyond safe threshold.

   Event: QUEUE_LATENCY_SPIKE
     -> Proposed Transition: DEGRADED -> SATURATED
        Reason: Latency spike in degraded state indicates saturation.
   ...
   ```

4. **Verify Trace**
   A JSON trace file is generated at `examples/infra-observer/infra.trace.json`.
   This trace contains the cryptographic proof of the state transitions.

## What is happening?

*   **Events (Input):** Raw signals like `CONNECTION_BACKLOG_GROWING` or `METRICS_STABILIZED`.
*   **Observer (Logic):** A deterministic state machine (`src/observer.ts`) that evaluates events against the *current* state.
*   **Proposals (Output):** instead of changing state blindly, the observer *proposes* a transition (e.g., "I think we should go to DEGRADED because X").
*   **Admissibility:** In a full system, a policy layer would approve this. Here, we simulate auto-approval to show the flow.

## Why this matters?

Unlike a simple `if (cpu > 80) scale_up()`, this approach:
1.  **Remembers "Why":** The `explanation` field is permanently recorded in the trace.
2.  **Prevents Thrashing:** State transitions are explicit and can be rate-limited or rejected.
3.  **Audit Ready:** You can prove *exactly* why the system was in `SATURATED` mode at 14:00.

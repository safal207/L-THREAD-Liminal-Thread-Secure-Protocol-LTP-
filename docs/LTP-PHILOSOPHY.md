# LTP Philosophy

LTP keeps the routing surface small and deterministic so engineers can reason about what happens next. The protocol exists to expose orientation, explainable branching, and focus snapshots in a way that can be audited and replayed.

## Ethos

> I am not building a system that knows for you.
> I am creating a space where you can see where you are and choose your own path.

## Design Principles

- **Deterministic core first.** Freeze the frame surface so conformance, SDKs, and demos stay aligned.
- **Explainability over mystique.** Every branch in a route response must be justifiable from observable state.
- **Stateful transparency.** Orientation and focus snapshots are telemetry, not predictions.
- **Optional depth.** Philosophical framing remains available without blocking engineers from shipping.

## How it applies to the protocol

- The canonical flow is locked so integrations can be verified and certified.
- Orientation names the semantic position; route responses surface the plausible paths; focus snapshots capture state for operators.
- Governance and RFCs extend the protocol cautiously to preserve determinism and explainability.

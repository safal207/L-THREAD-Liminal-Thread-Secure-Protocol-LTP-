# Orientation (Canonical)

Orientation is not prediction.

Prediction produces output.
Orientation governs coherence.

LTP introduces an explicit orientation layer that persists across time,
retries, restarts, and model changes. It records trajectories and constraints,
not answers.

Errors are local.
Loss of orientation is not.

## What LTP Preserves

- Trajectory continuity across executions
- Drift history and admissible future branches
- Deterministic replay independent of model/provider
- Constraint-respecting routing under failure and retries

## What LTP Does NOT Do

- LTP does not make decisions
- LTP does not predict outcomes
- LTP does not optimize behavior
- LTP does not store embeddings or memories

LTP preserves the path through change.
Nothing more. Nothing less.

> 🔒 Rule: this file is changed only via RFC.

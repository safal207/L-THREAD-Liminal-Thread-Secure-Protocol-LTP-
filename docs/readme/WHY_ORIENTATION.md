# Why Orientation

Most AI systems fail not because they predict poorly,
but because they lose orientation over time.

This usually becomes visible after retries, restarts,
or model changes — when behavior suddenly stops making sense.

LTP preserves orientation across these transitions.

It does not run a model.
It does not choose an answer.
It records how the system arrived where it is.

## The Core Idea

Prediction produces output.
Orientation governs coherence.

LTP separates these concerns.

## Why This Matters

- You can replay behavior without rerunning inference
- You can audit drift instead of guessing causes
- You can swap models without losing continuity
- You can recover safely after partial failure

## Start Here

If this resonates, read:
- docs/canon/ORIENTATION.md
- docs/contracts/ltp-inspect.v1.md

# WP6 Property Invariants

## Determinism

Same seed + same input must produce the same verdict.

## Fail closed

Rejected input must not mutate protocol state.

## Migration safety

Illegal migration transitions must never produce an accepted state.

## Replay safety

Replay attempts must produce deterministic rejection.

## Downgrade safety

Security floor bypass attempts must be blocked.

## Evidence integrity

Every adversarial run must produce a reproducible digest.

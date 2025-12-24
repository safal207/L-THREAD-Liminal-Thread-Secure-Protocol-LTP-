# LTP Inspector traces (MVP)

These traces are intentionally small and human-readable. They are designed for the Inspector CLI (`pnpm -w ltp:inspect -- --format human --input <file>`) without invoking any model execution.

## Files

- `canonical-linear.json` — steady path where continuity stays intact and drift settles after routing.
  - Look at `focus_momentum` rising into the route and the `drift_history` collapsing to `0.22` after the focus snapshot.
  - Admissible vs degraded futures surface the rationale for the primary branch.

- `drift-recovery.json` — drift spikes, recovery branch is selected, drift drops.
  - Notice `drift` falling from `0.71` to `0.32` and the blocked exploratory branch because drift was too high.
  - Constraints show both the “stay on rails” guidance and the non-goal prohibiting resets.

- `constraint-blocked.json` — constraints stop a write path.
  - `continuity_token` stays stable while branch `A` is blocked by read-only guardrails.
  - Branch `B` remains admissible for analysis-only work, illustrating how futures separate safe vs blocked actions.

- `bad.trace.json` — intentionally broken integrity for testing failure modes.
  - Frame 2 has a `prev_hash` ("bad_hash...") that does not match the hash of Frame 1.
  - Useful for verifying that `ltp-inspect` correctly reports **Integrity: FAIL**.

Each trace is short enough to read directly and to replay with `pnpm -w ltp:inspect -- replay --input <file>` for step-by-step orientation.

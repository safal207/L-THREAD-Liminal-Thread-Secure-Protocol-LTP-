# LTP Inspector (v1)

LTP does not choose actions. It maintains orientation so actions remain coherent over time. Inspector emits a versioned, deterministic state summary suitable for CI, audits, and replay — **no model execution, no retries, no decisions.**

The LTP Inspector is a **read-only DevTool** for understanding canonical frame logs with deterministic, CI-friendly output. It shows:
- `identity` derived from orientation
- `focus_momentum` if present
- compressed `drift_history` from `focus_snapshot`
- admissible vs degraded vs blocked futures (with rationale and constraints)
- constraint set active at any step
- deltas between adjacent steps

## Usage

```bash
# Inspect a trace (no model execution)
pnpm -w ltp:inspect -- --input examples/traces/drift-recovery.json

# Human-readable view with admissible futures and drift history
pnpm -w ltp:inspect -- --format human --input examples/traces/canonical-linear.json

# Replay the frames as recorded
pnpm -w ltp:inspect -- replay --input examples/traces/canonical-linear.json

# Explain constraints and deltas at a specific step
pnpm -w ltp:inspect -- explain --input examples/traces/constraint-blocked.json --at step-3
```

Output is stable within minor versions and follows CI semantics: drift is informational, continuity breaks fail, confidence gaps warn, and out-of-range confidence fails.

The Inspector is the foundation for future DevTools and enterprise integrations.

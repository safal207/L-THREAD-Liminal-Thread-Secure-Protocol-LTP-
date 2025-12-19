# LTP Inspector (v1)

LTP does not choose actions. It maintains orientation so actions remain coherent over time. Inspector emits a versioned, deterministic state summary suitable for CI, audits, and replay.

The LTP Inspector is a **read-only DevTool** for understanding canonical frame logs with deterministic, CI-friendly output.

## What it does
- Reads canonical LTP frame logs (JSON array or JSONL)
- Presents a deterministic JSON summary and matching human view
- Explains outcomes and deviations without mutating the log
- Emits contract metadata: `contract`, `generated_at`, `tool`, and `input`

## What it does NOT do
- No UI or dashboards
- No interactivity
- No recommendations or optimization
- No dependency on verify runtime

## Usage

```bash
pnpm -w ltp:inspect -- --input frames.jsonl                     # JSON summary by default
pnpm -w ltp:inspect -- --format human --input frames.jsonl      # Human-readable summary
pnpm -w ltp:inspect -- replay --input frames.jsonl --from t3
pnpm -w ltp:inspect -- explain --input frames.jsonl --branch A
```

Output is stable within minor versions and follows CI semantics: drift is informational, continuity breaks fail, confidence gaps warn, and out-of-range confidence fails.

The Inspector is the foundation for future DevTools and enterprise integrations.

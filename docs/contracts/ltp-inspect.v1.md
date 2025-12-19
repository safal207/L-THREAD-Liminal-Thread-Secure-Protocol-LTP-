# ltp:inspect contract v1.0

- **Scope:** read-only orientation summaries; no decision making or normalization.
- **Determinism:** field ordering is stable; branches are sorted by `id`; timestamps are ISO-8601.
- **Top-level fields:** `contract`, `generated_at`, `tool`, `input`, `orientation`, `continuity`, `branches`, `notes`.
- **Schema:** canonical JSON Schema lives at [`docs/contracts/ltp-inspect.v1.schema.json`](./ltp-inspect.v1.schema.json).
- **Compatibility:** v1 fields are stable; additions will be backward-compatible via optional keys.
- **Input surface:** accepts JSON arrays or JSONL streams of canonical LTP frames.

Example (truncated):

```json
{
  "contract": { "name": "ltp-inspect", "version": "1.0", "schema": "docs/contracts/ltp-inspect.v1.schema.json" },
  "generated_at": "2024-01-01T00:00:00.000Z",
  "tool": { "name": "ltp:inspect", "build": "dev" },
  "input": { "path": "/abs/path/frames.jsonl", "frames": 3, "format": "jsonl" },
  "orientation": { "stable": true, "drift_level": "medium" },
  "continuity": { "preserved": true, "notes": [] },
  "branches": [{ "id": "A", "status": "admissible", "confidence": 0.62 }],
  "notes": ["retry updated drift"]
}
```

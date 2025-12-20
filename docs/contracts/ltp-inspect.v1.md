# ltp:inspect contract v1.0

- **Scope:** read-only orientation summaries; no decision making or normalization.
- **MUST:** stable field ordering, `branches` sorted by descending `confidence` then `id`, ISO-8601 timestamps.
- **SHOULD:** include tool build metadata and input descriptors (path, count, format).
- **MAY:** emit debug notes and vendor extensions (prefixed fields) without affecting stability.
- **Top-level fields:** `contract`, `generated_at`, `tool`, `input`, `orientation`, `continuity`, `futures`, `branches`, `notes`.
- **Schema:** canonical JSON Schema lives at [`docs/contracts/ltp-inspect.v1.schema.json`](./ltp-inspect.v1.schema.json).
- **Compatibility:** v1 fields are stable; additions will be backward-compatible via optional keys.
- **Input surface:** accepts JSON arrays or JSONL streams of canonical LTP frames.
- **Trace validation:** input frames must declare `v`/`version` = `0.1`, use object payloads, and keep branch ids unique and pre-sorted; violations fail with exit code `2`.

## Field stability

| Path | Type | Meaning | Stability |
| --- | --- | --- | --- |
| `orientation.stable` | boolean | Whether an `orientation` frame was observed | Stable |
| `orientation.identity` | string | Derived identity from orientation payload or continuity token | Stable |
| `orientation.focus_momentum` | number | Latest observed focus momentum (if present) | Optional |
| `orientation.drift_history[]` | array | Compressed drift observations from `focus_snapshot` frames | Optional |
| `continuity.preserved` | boolean | Whether the continuity token remained consistent | Stable |
| `branches[].confidence` | number 0..1 | Reported branch confidence score | Stable |
| `futures.admissible[]` | array | Branches with admissible status | Optional |
| `notes[]` | string | Human-readable observations and warnings | Best-effort |

Example (truncated):

```json
{
  "contract": { "name": "ltp-inspect", "version": "1.0", "schema": "docs/contracts/ltp-inspect.v1.schema.json" },
  "generated_at": "2024-01-01T00:00:00.000Z",
  "tool": { "name": "ltp:inspect", "build": "dev" },
  "input": { "path": "/abs/path/frames.jsonl", "frames": 3, "format": "jsonl" },
  "orientation": {
    "identity": "ct-1",
    "stable": true,
    "drift_level": "medium",
    "drift_history": [{ "id": "t1", "value": 0.55 }]
  },
  "continuity": { "preserved": true, "notes": [], "token": "ct-1" },
  "branches": [{ "id": "A", "status": "admissible", "confidence": 0.62 }],
  "futures": { "admissible": [{ "id": "A", "status": "admissible", "confidence": 0.62 }], "degraded": [], "blocked": [] },
  "notes": ["retry updated drift"]
}
```

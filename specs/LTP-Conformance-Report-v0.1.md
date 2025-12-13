# LTP Conformance Report v0.1

This schema defines the machine-readable output produced by the **LTP Conformance Kit**. Reports are deterministic for identical inputs, suitable for CI artifacts, badges, and vendor attestations.

## Report schema

```ts
export type ConformanceReport = {
  v: '0.1';
  ok: boolean;
  score: number; // 0..1 inclusive
  frameCount: number;
  passed: string[];
  warnings: Array<{ code: string; message: string; at?: number; frameId?: string }>;
  errors: Array<{ code: string; message: string; at?: number; frameId?: string }>;
  hints: string[];
  annotations?: Record<string, any>;
  meta: {
    timestamp: number; // epoch ms
    tool: 'ltp-conformance-kit';
    toolVersion: string;
    inputName?: string;
    inputHash?: string; // sha256 of raw input
  };
};
```

Rules:

- Arrays must preserve insertion order for deterministic output.
- `score` starts at `1.0`, subtracts `0.05` per warning and `0.2` per error, and is clamped to `[0,1]` with three-decimal precision.
- `ok` is `true` when `errors.length === 0`.
- `meta.inputHash` is the SHA-256 of the original JSON payload when available.

### Directory batch reports

Directory-level verification produces an aggregate object used for CI summaries and badges:

```ts
export type ConformanceReportBatch = {
  v: '0.1';
  ok: boolean;
  score: number; // average of child scores
  reports: ConformanceReport[];
  summary: {
    total: number;
    passed: number; // no warnings or errors
    warned: number; // warnings only
    failed: number; // at least one error
  };
  meta: ConformanceReport['meta'];
};
```

The batch object keeps the same `meta.tool` fields for consistency and can be safely written to the same `reports/ltp-conformance-report.json` path when running `verify:dir`.

## Scoring rationale

- Start from **1.0**.
- Subtract **0.05** for every warning.
- Subtract **0.2** for every error.
- Clamp the result to `[0,1]` and emit with three-decimal precision for stable comparisons.

This mirrors the lightweight scoring model used by the conformance endpoint tests while staying easy to audit.

## Badge output

The kit also writes `reports/ltp-conformance-badge.json` with a Shields-compatible payload:

```json
{ "label": "LTP", "message": "conformant v0.1", "color": "brightgreen" }
```

Color rules:

- `brightgreen` when `ok === true` and there are no warnings.
- `yellow` when `ok === true` and warnings are present.
- `red` when any errors are present.

## Usage notes

- The default output path is `reports/ltp-conformance-report.json`; override via `--out`.
- `--strict` treats warnings as failures for exit codes while keeping the report payload unchanged.
- Deterministic inputs (same file content, same timestamp) produce identical reports byte-for-byte.

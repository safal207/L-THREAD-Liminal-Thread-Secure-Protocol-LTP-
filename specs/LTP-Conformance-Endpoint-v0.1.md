# LTP Conformance Endpoint v0.1

The `/conformance/verify` endpoint validates captured LTP frame sequences for structural integrity and ordering. It is deterministic for identical inputs and safe to expose in demo environments with minimal safeguards.

## Endpoint

- **Method:** `POST`
- **Path:** `/conformance/verify`
- **Content-Type:** `application/json`
- **Body size:** Hard limit of 512 KiB and 5,000 frames. Oversized requests return `413`.

## Request Schema

```ts
interface ConformanceVerifyRequest {
  frames: Array<{
    v: "0.1";
    id: string;
    ts: number; // non-decreasing
    type: "hello" | "heartbeat" | "orientation" | "route_request" | "route_response" | "focus_snapshot" | string; // unknown types allowed
    payload: unknown;
    from?: string;
    to?: string;
  }>;
}
```

Rules:
- `frames` **must** be an array (otherwise `400`).
- The first frame **must** be `hello`.
- Versions other than `0.1` are rejected.
- Frame IDs are tracked per-sender to warn on duplicates.
- Timestamps must be monotonic; regressions trigger warnings and `422` if validation fails overall.
- Unknown frame `type` values are **ignored** for scoring but reported as warnings for forward compatibility.

## Response Schema

```ts
interface ConformanceVerifyResponse {
  ok: boolean;
  score: number;            // 0.0 - 1.0 (deterministic)
  errors: string[];
  warnings: string[];
  passed: string[];
  hints: string[];
  annotations: string[];    // ordered log of checks
  frameCount: number;       // number of frames evaluated
  httpStatus?: number;      // included in response body for transparency
}
```

HTTP status codes:
- `200` — request validated (may include warnings).
- `400` — structurally invalid payload (e.g., missing fields, non-array frames).
- `413` — payload too large.
- `422` — semantically invalid ordering (e.g., missing leading hello, timestamp regression).

Errors are never thrown; all failures respond with `ok: false` and populated `errors`.

## Examples

### Minimal valid flow

```json
{
  "frames": [
    { "v": "0.1", "id": "h-1", "ts": 1, "type": "hello", "payload": { "role": "client", "message": "hi" } },
    { "v": "0.1", "id": "hb-1", "ts": 2, "type": "heartbeat", "payload": { "seq": 1 } },
    { "v": "0.1", "id": "ori-1", "ts": 3, "type": "orientation", "payload": { "origin": "a", "destination": "b", "mode": "demo" } },
    { "v": "0.1", "id": "req-1", "ts": 4, "type": "route_request", "payload": { "goal": "demo", "context": ["seed"] } },
    {
      "v": "0.1",
      "id": "resp-1",
      "ts": 5,
      "type": "route_response",
      "payload": {
        "branches": {
          "primary": { "path": ["a", "b"], "confidence": 0.8 },
          "recover": { "path": ["b", "c"], "confidence": 0.5 },
          "explore": { "path": ["c", "d"], "confidence": 0.4 }
        },
        "selection": "primary"
      }
    }
  ]
}
```

Response (200):
```json
{
  "ok": true,
  "score": 1,
  "warnings": [],
  "errors": [],
  "annotations": [
    "INFO: hello frame initiates the session",
    "INFO: frame 0 passed structural validation (hello)",
    "INFO: frame 1 passed structural validation (heartbeat)",
    "INFO: frame 2 passed structural validation (orientation)",
    "INFO: frame 3 passed structural validation (route_request)",
    "INFO: frame 4 passed structural validation (route_response)"
  ]
}
```

### Warning flow (unknown type)

```json
{
  "frames": [
    { "v": "0.1", "id": "h-1", "ts": 1, "type": "hello", "payload": { "role": "client", "message": "hi" } },
    { "v": "0.1", "id": "hb-1", "ts": 2, "type": "heartbeat", "payload": { "seq": 1 } },
    { "v": "0.1", "id": "future", "ts": 3, "type": "route_prediction", "payload": {} }
  ]
}
```

Response (200):
```json
{
  "ok": true,
  "warnings": ["frame 2 has unknown type: route_prediction"],
  "hints": ["address warnings to improve conformance score"],
  "annotations": [
    "INFO: hello frame initiates the session",
    "INFO: frame 0 passed structural validation (hello)",
    "INFO: frame 1 passed structural validation (heartbeat)",
    "WARNING: frame 2 has unknown type: route_prediction",
    "INFO: address warnings to improve conformance score"
  ]
}
```

### Error flow (missing hello)

```json
{
  "frames": [
    { "v": "0.1", "id": "hb-1", "ts": 1, "type": "heartbeat", "payload": { "seq": 1 } }
  ]
}
```

Response (422):
```json
{
  "ok": false,
  "errors": ["first frame must be a hello frame"],
  "hints": ["prepend a hello frame to initiate the session chain"],
  "annotations": ["ERROR: first frame must be a hello frame"],
  "score": 0
}
```

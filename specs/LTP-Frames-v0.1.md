# LTP Frames v0.1 — Status: Draft (Frozen for v0.1)

## Purpose
Frames are the minimal, self-describing units of the Liminal Thread Protocol (LTP). Each frame expresses the state of a line at a moment in time and can be understood equally by Rust nodes, Node gateways, JS SDKs, and HUDs without depending on any specific storage layer. Frames are additive: new frame types may be introduced, but existing ones must not be broken.

## Common contract
All frames conform to the shared structure below. The `payload` semantics are defined per frame type.

```ts
interface LTPFrame {
  v: "0.1";          // protocol version
  id: string;         // unique frame id
  ts: number;         // unix timestamp in milliseconds
  type: FrameType;    // frame discriminator
  from?: string;      // optional node/agent id
  to?: string;        // optional target
  payload: object;    // frame-specific content
}
```

## Frame types (v0.1)

### 1. `hello`
Establishes presence and capabilities.

```json
{
  "type": "hello",
  "payload": {
    "role": "node | client | agent | hud",
    "capabilities": ["ws", "routing", "focus"]
  }
}
```

### 2. `heartbeat`
Signals liveness and timing characteristics.

```json
{
  "type": "heartbeat",
  "payload": {
    "seq": 42,
    "latency_ms": 18,
    "load": 0.21
  }
}
```

### 3. `orientation`
Describes the current semantic position of the line.

```json
{
  "type": "orientation",
  "payload": {
    "mode": "calm | storm | shift",
    "focus": 0.72,
    "vector": ["explore", "stabilize"]
  }
}
```

### 4. `route_request`
Requests routing guidance with intent and constraints.

```json
{
  "type": "route_request",
  "payload": {
    "intent": "decision",
    "constraints": {
      "risk": "low",
      "depth": "high"
    }
  }
}
```

### 5. `route_response`
Returns multiple possible branches with confidences.

```json
{
  "type": "route_response",
  "payload": {
    "branches": [
      { "id": "primary", "confidence": 0.62 },
      { "id": "recover", "confidence": 0.23 },
      { "id": "explore", "confidence": 0.15 }
    ]
  }
}
```

### 6. `focus_snapshot`
Captures the line state for HUDs and self-diagnostics.

```json
{
  "type": "focus_snapshot",
  "payload": {
    "health": "OK | WARN | CRITICAL",
    "volatility": 0.34,
    "depth": 0.81,
    "tenderness": 0.66
  }
}
```

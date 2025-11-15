# LTP Message Format Specification v0.1

## 1. Overview

All LTP messages (except handshake) use a unified JSON envelope format. This ensures consistent context propagation, tracing, and extensibility across all message types.

**Design Principles:**
- Simple JSON structure for v0.1
- Every message carries session context (`thread_id`, `session_id`)
- Extensible `payload` for message-specific data
- `meta` field for cross-cutting concerns (tracing, signatures, etc.)

## 2. Base Envelope Format

### 2.1 Structure

```json
{
  "type": "message_type",
  "thread_id": "uuid",
  "session_id": "uuid",
  "timestamp": 1731600000,
  "payload": {},
  "meta": {}
}
```

### 2.2 Field Specifications

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Message type identifier (see section 3) |
| `thread_id` | string | Yes | UUID of the liminal thread session |
| `session_id` | string | Yes | UUID of the current connection |
| `timestamp` | number | Yes | Unix epoch time in seconds (integer) |
| `payload` | object | No | Message-specific data (structure varies by type) |
| `meta` | object | No | Metadata for tracing, debugging, future security |

### 2.3 Meta Field Structure

The `meta` object is optional but recommended for production systems:

```json
{
  "meta": {
    "client_id": "string",
    "trace_id": "string",
    "parent_span_id": "string",
    "user_agent": "string",
    "signature": "base64-string (future)"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client_id` | string | No | Client identifier (same as handshake) |
| `trace_id` | string | No | Distributed tracing ID |
| `parent_span_id` | string | No | Parent span for distributed tracing |
| `user_agent` | string | No | Client user agent string |
| `signature` | string | No | Message signature (reserved for v0.2+) |

## 3. Message Types (v0.1)

### 3.1 Message Type Registry

| Type | Direction | Description |
|------|-----------|-------------|
| `handshake_init` | Client → Server | Initiate handshake (special format, see LTP-handshake.md) |
| `handshake_ack` | Server → Client | Acknowledge handshake (special format, see LTP-handshake.md) |
| `ping` | Client → Server | Heartbeat check |
| `pong` | Server → Client | Heartbeat response |
| `state_update` | Bidirectional | Update inner state |
| `event` | Bidirectional | Discrete event notification |
| `error` | Server → Client | Error notification |

### 3.2 ping

**Purpose:** Client heartbeat to keep connection alive.

**Direction:** Client → Server

**Payload:** Empty or minimal

**Example:**
```json
{
  "type": "ping",
  "thread_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "session_id": "a8f5f167-d5a1-4c42-9e12-3d8f72e6b5c1",
  "timestamp": 1731600000,
  "payload": {},
  "meta": {
    "client_id": "client-123"
  }
}
```

### 3.3 pong

**Purpose:** Server response to `ping`.

**Direction:** Server → Client

**Payload:** Empty or echo of ping data

**Example:**
```json
{
  "type": "pong",
  "thread_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "session_id": "a8f5f167-d5a1-4c42-9e12-3d8f72e6b5c1",
  "timestamp": 1731600001,
  "payload": {},
  "meta": {}
}
```

### 3.4 state_update

**Purpose:** Communicate changes in inner state (client) or system state (server).

**Direction:** Bidirectional

**Payload Structure:**

```json
{
  "payload": {
    "kind": "minimal|full|delta",
    "data": {
      // Application-specific state data
    }
  }
}
```

**Payload Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kind` | string | Yes | State update type: `minimal`, `full`, `delta` |
| `data` | object | Yes | State data (structure defined by application/LRI) |

**Example (Client → Server):**
```json
{
  "type": "state_update",
  "thread_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "session_id": "a8f5f167-d5a1-4c42-9e12-3d8f72e6b5c1",
  "timestamp": 1731600000,
  "payload": {
    "kind": "minimal",
    "data": {
      "mood": "curious",
      "focus": "exploration",
      "energy_level": 0.8
    }
  },
  "meta": {
    "client_id": "client-123",
    "trace_id": "trace-abc-123"
  }
}
```

**Example (Server → Client):**
```json
{
  "type": "state_update",
  "thread_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "session_id": "a8f5f167-d5a1-4c42-9e12-3d8f72e6b5c1",
  "timestamp": 1731600005,
  "payload": {
    "kind": "delta",
    "data": {
      "lri_resonance": 0.92,
      "suggested_action": "continue_exploration"
    }
  },
  "meta": {
    "trace_id": "trace-abc-123"
  }
}
```

### 3.5 event

**Purpose:** Send discrete event notifications (user actions, system events).

**Direction:** Bidirectional

**Payload Structure:**

```json
{
  "payload": {
    "event_type": "string",
    "data": {}
  }
}
```

**Payload Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event_type` | string | Yes | Event category/type |
| `data` | object | Yes | Event-specific data |

**Example (Client → Server):**
```json
{
  "type": "event",
  "thread_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "session_id": "a8f5f167-d5a1-4c42-9e12-3d8f72e6b5c1",
  "timestamp": 1731600000,
  "payload": {
    "event_type": "user_action",
    "data": {
      "action": "button_click",
      "target": "explore_mode",
      "screen": "home"
    }
  },
  "meta": {
    "client_id": "client-123"
  }
}
```

**Example (Server → Client):**
```json
{
  "type": "event",
  "thread_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "session_id": "a8f5f167-d5a1-4c42-9e12-3d8f72e6b5c1",
  "timestamp": 1731600010,
  "payload": {
    "event_type": "lri_insight",
    "data": {
      "insight_type": "resonance_peak",
      "message": "High resonance detected in exploration mode"
    }
  },
  "meta": {}
}
```

### 3.6 error

**Purpose:** Server error notification.

**Direction:** Server → Client

**Payload Structure:**

```json
{
  "payload": {
    "error_code": "string",
    "error_message": "string",
    "details": {}
  }
}
```

**Note:** `error` messages MAY omit `thread_id`/`session_id` if error occurs before handshake completion.

**Example:**
```json
{
  "type": "error",
  "thread_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "session_id": "a8f5f167-d5a1-4c42-9e12-3d8f72e6b5c1",
  "timestamp": 1731600000,
  "payload": {
    "error_code": "INVALID_STATE_UPDATE",
    "error_message": "State update missing required field: kind",
    "details": {
      "field": "payload.kind",
      "expected": "minimal|full|delta"
    }
  },
  "meta": {}
}
```

## 4. Custom Message Types

Higher-layer protocols (like LRI) can define custom message types using namespace prefix:

**Format:** `namespace:type`

**Examples:**
- `lri:resonance_pattern`
- `lri:intent_query`
- `custom:analytics_event`

**Example Custom Message:**
```json
{
  "type": "lri:resonance_pattern",
  "thread_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "session_id": "a8f5f167-d5a1-4c42-9e12-3d8f72e6b5c1",
  "timestamp": 1731600000,
  "payload": {
    "pattern": "exploration",
    "intensity": 0.8,
    "duration_ms": 5000
  },
  "meta": {
    "client_id": "client-123"
  }
}
```

## 5. Validation Rules

### 5.1 Required Field Validation

Implementations MUST reject messages missing required fields:

```json
{
  "type": "error",
  "timestamp": 1731600000,
  "payload": {
    "error_code": "MISSING_REQUIRED_FIELD",
    "error_message": "Field 'thread_id' is required",
    "details": {
      "missing_field": "thread_id"
    }
  }
}
```

### 5.2 Type Validation

Implementations SHOULD validate field types:

- `thread_id`: UUID v4 format
- `session_id`: UUID v4 format
- `timestamp`: Integer (Unix epoch seconds)
- `type`: Non-empty string

### 5.3 Unknown Field Handling

Implementations MUST ignore unknown fields in messages (forward compatibility).

**Example:**
```json
{
  "type": "state_update",
  "thread_id": "...",
  "session_id": "...",
  "timestamp": 1731600000,
  "future_field": "will be ignored in v0.1",
  "payload": {}
}
```

## 6. Size Limits

### 6.1 Recommended Limits

| Component | Limit | Notes |
|-----------|-------|-------|
| Total message size | 1 MB | JSON serialized |
| `payload` nesting depth | 10 levels | Prevent deeply nested objects |
| String field max length | 64 KB | Individual string values |

### 6.2 Oversized Message Error

```json
{
  "type": "error",
  "timestamp": 1731600000,
  "payload": {
    "error_code": "MESSAGE_TOO_LARGE",
    "error_message": "Message exceeds 1 MB limit",
    "details": {
      "size_bytes": 1500000,
      "max_bytes": 1048576
    }
  }
}
```

## 7. Encoding

### 7.1 Character Encoding

All LTP messages MUST use UTF-8 encoding.

### 7.2 JSON Formatting

- MUST be valid JSON per RFC 8259
- MAY be minified (no whitespace) for transmission
- SHOULD NOT include trailing commas
- MUST NOT include comments

### 7.3 Timestamp Format

Unix epoch time in **seconds** (not milliseconds):

```javascript
// Correct
"timestamp": 1731600000

// Incorrect (milliseconds)
"timestamp": 1731600000000
```

## 8. Message Flow Examples

### 8.1 Typical Session Flow

```json
// 1. Client: handshake_init (see LTP-handshake.md)

// 2. Server: handshake_ack (see LTP-handshake.md)

// 3. Client: state_update
{
  "type": "state_update",
  "thread_id": "7c9e...",
  "session_id": "a8f5...",
  "timestamp": 1731600000,
  "payload": {
    "kind": "minimal",
    "data": { "mood": "focused" }
  },
  "meta": { "client_id": "client-123" }
}

// 4. Server: event (LRI insight)
{
  "type": "event",
  "thread_id": "7c9e...",
  "session_id": "a8f5...",
  "timestamp": 1731600001,
  "payload": {
    "event_type": "lri_ready",
    "data": { "status": "initialized" }
  },
  "meta": {}
}

// 5. Client: ping (heartbeat)
{
  "type": "ping",
  "thread_id": "7c9e...",
  "session_id": "a8f5...",
  "timestamp": 1731600015,
  "payload": {},
  "meta": { "client_id": "client-123" }
}

// 6. Server: pong
{
  "type": "pong",
  "thread_id": "7c9e...",
  "session_id": "a8f5...",
  "timestamp": 1731600015,
  "payload": {},
  "meta": {}
}

// 7. Client: event (user action)
{
  "type": "event",
  "thread_id": "7c9e...",
  "session_id": "a8f5...",
  "timestamp": 1731600020,
  "payload": {
    "event_type": "user_action",
    "data": {
      "action": "navigation",
      "from": "home",
      "to": "settings"
    }
  },
  "meta": { "client_id": "client-123" }
}
```

## 9. Future Enhancements

### v0.2
- Binary encoding option (CBOR, MessagePack)
- Message compression (zstd)
- Digital signatures in `meta.signature`

### v0.3
- Message sequence numbers for ordering
- Acknowledgment mechanism for critical messages
- Batch message support

---

**Document Version:** 0.1
**Last Updated:** 2025-11-14
**Status:** Initial Draft

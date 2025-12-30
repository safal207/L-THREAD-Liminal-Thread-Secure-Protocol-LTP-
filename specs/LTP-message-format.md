# LTP Message Format Specification v0.3

## 1. Overview

All LTP messages (except handshake) use a unified JSON envelope format. This ensures consistent context propagation, tracing, and extensibility across all message types.

**Design Principles:**
- Simple JSON structure for v0.3
- Every message carries session context (`thread_id`, `session_id`)
- Extensible `payload` for message-specific data
- `meta` field for cross-cutting concerns (tracing, liminal metadata, etc.)
- Optional security hooks (`nonce`, `signature`) attached to the envelope
- Optional `content_encoding` field for TOON payload support (v0.3+)

## 2. Base Envelope Format

### 2.1 Structure

```json
{
  "type": "message_type",
  "thread_id": "uuid",
  "session_id": "uuid",
  "timestamp": 1731600000,
  "content_encoding": "json",
  "payload": {},
  "meta": {},
  "nonce": "client-uuid-1699824000000-12345",
  "signature": "v0-placeholder"
}
```

### 2.2 Field Specifications

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Message type identifier (see section 3) |
| `thread_id` | string | Yes | UUID of the liminal thread session |
| `session_id` | string | Yes | UUID of the current connection |
| `timestamp` | number | Yes | Unix epoch time in seconds (integer) |
| `content_encoding` | string | No | Payload encoding: `"json"` (default) or `"toon"` (v0.3+) |
| `payload` | object | No | Message-specific data (structure varies by type) |
| `meta` | object | No | Metadata for tracing, debugging, liminal context |
| `nonce` | string | No | Client-provided unique value per message (at least per session) |
| `signature` | string | No | Placeholder for future integrity/authentication |

### 2.3 Meta Field Structure

The `meta` object is optional but recommended for production systems:

```json
{
  "meta": {
    "client_id": "string",
    "trace_id": "string",
    "parent_span_id": "string",
    "user_agent": "string",
    "causality": {
      "cause": {
        "kind": "string",
        "ref": "string"
      },
      "context": {
        "state_ref": "string",
        "inputs": ["string"]
      },
      "horizon": {
        "window": "string",
        "constraints": ["string"]
      }
    },
    "affect": {
      "valence": 0.3,
      "arousal": -0.2
    },
    "context_tag": "evening_reflection"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client_id` | string | No | Client identifier (same as handshake) |
| `trace_id` | string | No | Distributed tracing ID |
| `parent_span_id` | string | No | Parent span for distributed tracing |
| `user_agent` | string | No | Client user agent string |
| `causality` | object | Conditional | Required for any value transfer, state transition, agent decision, or autonomous action involving value/risk |
| `causality.cause` | object | Conditional | Machine-readable cause (see 2.3.1) |
| `causality.context` | object | Conditional | Context snapshot or references (see 2.3.1) |
| `causality.horizon` | object | Conditional | Consequence/risk bounds (see 2.3.1) |
| `affect` | object | No | Emotional state metadata (for LRI and semantic layers) |
| `affect.valence` | number | No | Emotional valence: -1 (negative) to 1 (positive) |
| `affect.arousal` | number | No | Arousal level: -1 (calm) to 1 (excited) |
| `context_tag` | string | No | Context identifier (e.g., "focus_session", "relax") |

**Note on Liminal Metadata:**
- `affect` and `context_tag` are optional fields designed for higher-level semantic protocols like LRI
- LTP implementations MUST support these fields but MUST NOT interpret their meaning
- These fields provide hooks for future semantic layers without imposing specific requirements

#### 2.3.1 Causality Axiom Schema (Non-Optional for Qualifying Operations)

For any LTP-traced operation involving value transfer, state transition, AI agent decision, or autonomous action with value/risk implications, `meta.causality` is **required**. Missing `cause`, `context`, or `horizon` makes the operation protocol-invalid and MUST be rejected **pre-commit**.

Minimal schema:

```json
{
  "causality": {
    "cause": {
      "kind": "string",
      "ref": "string"
    },
    "context": {
      "state_ref": "string",
      "inputs": ["string"]
    },
    "horizon": {
      "window": "string",
      "constraints": ["string"]
    }
  }
}
```

Field intent:
- `cause.kind`: machine-readable category (e.g., `policy`, `event`, `request`, `agent_rule`)
- `cause.ref`: identifier for the originating cause (event ID, rule ID, or trace reference)
- `context.state_ref`: pointer to the relevant state snapshot (hash, URI, or trace pointer)
- `context.inputs`: list of input references used to form the decision
- `horizon.window`: explicit consequence window (e.g., `1h`, `30d`, `bounded`)
- `horizon.constraints`: explicit bounds or limits on acceptable consequences/risk

LTP implementations MUST preserve `meta.causality` intact as part of the immutable trace and make it queryable for audit tooling.

### 2.4 Content Encoding (v0.3+)

The `content_encoding` field specifies how to interpret `payload.data`:

- **`"json"`** (default): `payload.data` is a standard JSON object or array. If `content_encoding` is omitted, JSON is assumed.
- **`"toon"`**: `payload.data` is a TOON-formatted string. See `LTP-toon.md` for TOON specification.

**Important Notes:**
- LTP itself does NOT parse or validate TOON format; it only carries the encoding flag.
- TOON parsing/encoding is the responsibility of the application layer (LRI) or a dedicated codec library.
- When `content_encoding="toon"`, `payload.data` MUST be a string containing valid TOON syntax.

### 2.5 Security Hooks (v0.2 skeleton)

- `nonce` MUST be unique per message at least within the active `session_id`. SDKs typically concatenate the `client_id`, timestamp, and a random suffix.
- `signature` is reserved for future MAC/signature schemes. In v0.2 SDKs populate placeholder values so the field is always present when transport policies require it.
- All LTP traffic SHOULD ride over TLS/WSS (`recommended_env`) until real cryptographic verification ships.

## 3. Message Types (v0.2)

### 3.1 Message Type Registry

| Type | Direction | Description |
|------|-----------|-------------|
| `handshake_init` | Client → Server | Initiate handshake (special format, see LTP-handshake.md) |
| `handshake_resume` | Client → Server | Resume existing thread (special format) |
| `handshake_ack` | Server → Client | Acknowledge handshake (special format, see LTP-handshake.md) |
| `handshake_reject` | Server → Client | Resume attempt rejected (special format) |
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

**Example with TOON payload (Client → Server):**

```json
{
  "type": "state_update",
  "thread_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "session_id": "a8f5f167-d5a1-4c42-9e12-3d8f72e6b5c1",
  "timestamp": 1731600000,
  "content_encoding": "toon",
  "payload": {
    "kind": "affect_log_v1",
    "data": "affect_log[3]{t,valence,arousal}:\n  1,0.2,-0.1\n  2,0.3,-0.2\n  3,0.1,0.0\n"
  },
  "meta": {
    "client_id": "client-123",
    "context_tag": "evening_reflection"
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
  "future_field": "will be ignored in v0.2",
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

## 9. Example: Evening Reflection Scenario

### 9.1 Overview

This example demonstrates how LTP (transport/meta) and LRI (semantic payload) work together in a real-world scenario: **evening reflection** - a user opening a liminal client at the end of the day to briefly note their state.

### 9.2 Scenario Context

**User Story:**
> At the end of the day, a user opens their liminal client (mobile or desktop) to reflect on their state. They briefly note their inner condition - energy, clarity, stress - and key highlights of the day. This creates a "thread of the day" that flows into LIMINAL OS (RINSE, memory, resonance systems).

**Communication Flow:**
1. User opens client → `handshake_init`
2. Server establishes thread → `handshake_ack`
3. User submits evening reflection → `state_update` with LRI envelope

### 9.3 Full LTP+LRI Message Example

```json
{
  "type": "state_update",
  "thread_id": "4f3c9e2a-8b21-4c71-9d3f-1a9b12345678",
  "session_id": "b42a6f10-91a7-4ce2-8b7e-9d5f98765432",
  "timestamp": 1731700000,
  "meta": {
    "client_id": "android-liminal-001",
    "trace_id": "evt-2025-11-15-001",
    "affect": {
      "valence": 0.2,
      "arousal": -0.3
    },
    "context_tag": "evening_reflection"
  },
  "payload": {
    "kind": "lri_envelope_v1",
    "data": {
      "actor": "user:self",
      "intent": "reflect_on_day",
      "summary": "Слегка устал, но есть чувство тихого продвижения.",
      "highlights": [
        "поиграл с детьми",
        "продвинул LTP протокол",
        "меньше тревоги о будущем"
      ],
      "inner_state": {
        "energy": 0.4,
        "clarity": 0.7,
        "stress": 0.3
      },
      "resonance_hooks": [
        "family",
        "creator_path",
        "long_horizon"
      ]
    }
  }
}
```

### 9.4 Layer Breakdown

#### LTP (Transport/Meta) Fields

These fields are handled by LTP itself - the protocol layer:

| Field | Layer | Description |
|-------|-------|-------------|
| `type` | LTP | Message type: `state_update` |
| `thread_id` | LTP | Unique liminal thread ID |
| `session_id` | LTP | Current connection session ID |
| `timestamp` | LTP | Unix epoch time (seconds) |
| `meta.client_id` | LTP | Client device identifier |
| `meta.trace_id` | LTP | Distributed tracing ID |

**LTP Responsibility:** Routing, context preservation, session management

#### LRI (Semantic) Fields

These fields are interpreted by LRI (Liminal Resonance Interface) - the application layer:

| Field | Layer | Description |
|-------|-------|-------------|
| `meta.affect` | LRI | Emotional valence/arousal coordinates |
| `meta.context_tag` | LRI | Semantic context label |
| `payload.kind` | LRI | Envelope format version |
| `payload.data.*` | LRI | All semantic content (intent, state, resonance) |

**LRI Responsibility:** Intent extraction, resonance matching, semantic processing

### 9.5 Extended Meta Fields for LRI

The `meta` object in evening reflection includes LRI-specific fields:

```json
{
  "meta": {
    "client_id": "android-liminal-001",      // LTP: device ID
    "trace_id": "evt-2025-11-15-001",        // LTP: tracing
    "affect": {                               // LRI: affective state
      "valence": 0.2,                         // slightly positive
      "arousal": -0.3                         // low energy
    },
    "context_tag": "evening_reflection"      // LRI: semantic tag
  }
}
```

**Why `affect` in `meta`?**
- Affects message routing and priority
- Cross-cutting concern like tracing
- Used by both transport (LTP) and semantic (LRI) layers

### 9.6 Server Processing Example

When the server receives this message, it can:

1. **LTP Layer** - Log transport context:
   ```
   LTP[4f3c9e2a.../b42a6f10...] ctx=evening_reflection affect={0.2,-0.3} intent=reflect_on_day
   ```

2. **LRI Layer** - Process semantic content:
   - Extract `intent: "reflect_on_day"`
   - Match `resonance_hooks: ["family", "creator_path", "long_horizon"]`
   - Update RINSE (Resonance INner State Engine) with `inner_state` values
   - Store highlights in memory graph
   - Calculate resonance score based on affect + inner_state

3. **Response** - Server might send back:
   ```json
   {
     "type": "state_update",
     "thread_id": "4f3c9e2a-8b21-4c71-9d3f-1a9b12345678",
     "session_id": "b42a6f10-91a7-4ce2-8b7e-9d5f98765432",
     "timestamp": 1731700001,
     "payload": {
       "kind": "lri_response_v1",
       "data": {
         "resonance_score": 0.85,
         "insight": "Strong clarity with moderate stress - creator mode remains accessible",
         "next_suggested_action": "light_reflection_tomorrow_morning"
       }
     },
     "meta": {}
   }
   ```

### 9.7 Implementation Note

This example shows how LTP provides a **protocol-level foundation** while remaining **semantically neutral**. The LTP spec defines:
- Message envelope structure (`type`, `thread_id`, `session_id`, etc.)
- Transport metadata (`client_id`, `trace_id`)
- Extensibility hooks (`meta`, `payload`)

The **meaning** of `payload.data` is defined by higher layers (LRI, LIMINAL OS), not by LTP itself. This separation allows LTP to serve as a general-purpose liminal transport protocol.

## 10. Future Enhancements

### v0.2
- Binary encoding option (CBOR, MessagePack)
- Message compression (zstd)
- Digital signatures in `meta.signature`
- Standardized `meta.affect` schema

### v0.3
- Message sequence numbers for ordering
- Acknowledgment mechanism for critical messages
- Batch message support
- LRI envelope versioning guidance

---

**Document Version:** 0.1
**Last Updated:** 2025-11-15
**Status:** Initial Draft

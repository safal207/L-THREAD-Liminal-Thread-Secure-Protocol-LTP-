# LTP Core Specification v0.1

## 1. Introduction

### 1.1 Purpose

The Liminal Thread Protocol (LTP) is a transport-level protocol designed to establish and maintain context-aware communication channels between client devices and the LIMINAL OS ecosystem. Unlike traditional request-response protocols, LTP maintains continuous **thread sessions** that preserve contextual state, user intent, and inner state metadata throughout the interaction lifecycle.

### 1.2 Goals

- Provide secure, persistent communication channels with context preservation
- Enable semantic protocols (like LRI) to operate without re-establishing context
- Support future cryptographic enhancements without breaking compatibility
- Maintain simplicity while allowing rich metadata exchange

### 1.3 Non-Goals (v0.1)

- Full end-to-end encryption (hooks provided for future implementation)
- Multi-device session synchronization (planned for v0.3+)
- Binary protocol format (JSON-only in v0.1)

## 2. Protocol Position in Stack

LTP operates between standard transport protocols (WebSocket/TCP/QUIC) and application-level semantic protocols (LRI):

```
┌───────────────────────────────────────────┐
│  Application Layer                        │
│  - LRI (Liminal Resonance Interface)      │
│  - Custom business logic                  │
│  - Resonance pattern matching             │
├───────────────────────────────────────────┤
│  LTP (Liminal Thread Protocol) ← YOU ARE HERE
│  - Session management                     │
│  - Context preservation                   │
│  - Message envelope                       │
│  - Future: crypto layer                   │
├───────────────────────────────────────────┤
│  Transport Layer                          │
│  - WebSocket (primary in v0.1)            │
│  - TCP, QUIC (future)                     │
└───────────────────────────────────────────┘
```

**Key Distinction:**
- **LTP:** How messages are transported securely with context
- **LRI:** What the messages mean semantically

## 3. Core Concepts

### 3.1 Liminal Thread Session

A **Liminal Thread Session** is the fundamental unit of LTP communication. It represents a continuous, context-preserving channel between a client and server.

**Properties:**

- `thread_id` (UUID): Unique identifier for the thread, persists across reconnections
- `session_id` (UUID): Unique identifier for the current connection instance
- `context`: Metadata about the client state (minimal in v0.1)
- `created_at`: Timestamp of thread creation
- `last_active_at`: Timestamp of last activity

**Lifecycle:**

1. **Initialization:** Client sends `handshake_init` message
2. **Establishment:** Server responds with `handshake_ack`, includes `thread_id` and `session_id`
3. **Active Communication:** Messages flow using unified LTP envelope
4. **Heartbeat:** Periodic `ping`/`pong` to maintain liveness
5. **Termination:** Explicit close or timeout

### 3.2 Context Preservation

LTP preserves context through:

1. **Thread Continuity:** Same `thread_id` can be resumed across connections
2. **Metadata Propagation:** Every message carries `thread_id`, `session_id`, `timestamp`
3. **Trace IDs:** Optional distributed tracing support via `meta.trace_id`
4. **State Hooks:** Payload structure allows rich inner state (defined by higher layers)

### 3.3 Message Envelope

All LTP messages (except raw handshake) use a unified JSON envelope structure:

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

See `LTP-message-format.md` for detailed specification.

## 4. Protocol Flow

### 4.1 Connection Establishment

```
Client                                    Server
  |                                         |
  |------ handshake_init ----------------→ |
  |                                         |
  |                                    (validate client)
  |                                    (create thread_id)
  |                                         |
  | ←----- handshake_ack ----------------- |
  |                                         |
  |        (connection established)         |
```

### 4.2 Active Session

```
Client                                    Server
  |                                         |
  |------ state_update ------------------→ |
  |                                         |
  | ←----- event -------------------------|  |
  |                                         |
  |------ ping --------------------------→ |
  | ←----- pong ---------------------------|
  |                                         |
```

### 4.3 Heartbeat Mechanism

- Server specifies `heartbeat_interval_ms` in `handshake_ack`
- Client should send `ping` at this interval
- Server responds with `pong`
- If no `ping` received within `2 × heartbeat_interval_ms`, server may close connection

## 5. Security Considerations (v0.1)

### 5.1 Current State

v0.1 provides **protocol structure** for security, not actual cryptographic implementation:

- No signature verification
- No key exchange
- No message encryption beyond transport layer (WSS)

### 5.2 Security Hooks

The protocol reserves fields for future security:

- `handshake_init.device_fingerprint`: Device identity (not verified in v0.1)
- `handshake_ack.nonce`: Challenge for future crypto handshake
- `meta.signature`: Reserved for message signing

### 5.3 Recommendations for v0.1

- Use WSS (WebSocket Secure) for transport encryption
- Implement authentication at application layer
- Treat v0.1 as trusted network only

## 6. Error Handling

### 6.1 Protocol Errors

If server receives malformed LTP message:

```json
{
  "type": "error",
  "error_code": "MALFORMED_MESSAGE",
  "error_message": "Missing required field: thread_id",
  "timestamp": 1731600000
}
```

### 6.2 Error Codes

- `MALFORMED_MESSAGE`: Invalid message structure
- `UNKNOWN_THREAD`: `thread_id` not recognized
- `SESSION_EXPIRED`: `session_id` no longer valid
- `UNSUPPORTED_VERSION`: LTP version not supported
- `RATE_LIMIT_EXCEEDED`: Too many messages (future)

## 7. Extensibility

### 7.1 Forward Compatibility

- Clients/servers MUST ignore unknown fields in messages
- New message types can be added without breaking existing implementations
- Version negotiation via `ltp_version` field

### 7.2 Custom Message Types

Higher-layer protocols can define custom message types:

```json
{
  "type": "lri:resonance_pattern",
  "thread_id": "...",
  "session_id": "...",
  "timestamp": 1731600000,
  "payload": {
    "pattern": "exploration",
    "intensity": 0.8
  }
}
```

Type prefix convention: `namespace:type` (e.g., `lri:`, `custom:`)

## 8. Implementation Notes

### 8.1 WebSocket Subprotocol

LTP should use WebSocket subprotocol identifier: `ltp.v0.1`

```javascript
const ws = new WebSocket('wss://example.com', 'ltp.v0.1');
```

### 8.2 Message Size Limits

Recommended limits (implementer-defined):

- Maximum message size: 1 MB (v0.1)
- Maximum `payload` nesting depth: 10 levels

### 8.3 Timestamp Format

All timestamps are Unix epoch time in seconds (integer).

```json
"timestamp": 1731600000
```

## 9. Compliance

An LTP v0.1 implementation is compliant if:

1. It correctly handles `handshake_init` and `handshake_ack` per `LTP-handshake.md`
2. It uses the message envelope format per `LTP-message-format.md`
3. It supports message types: `handshake_init`, `handshake_ack`, `ping`, `pong`
4. It includes `thread_id`, `session_id`, `timestamp` in all non-handshake messages
5. It ignores unknown fields without error
6. It rejects messages missing required fields with appropriate error

## 10. Future Directions

### v0.2
- Real cryptographic handshake (ECDH key exchange, Ed25519 signatures)
- Session recovery after disconnection
- Compression support (zstd)

### v0.3
- Multi-device thread synchronization
- Binary message format option (CBOR, MessagePack)
- Enhanced inner state schema

### v1.0
- Full security audit
- Production-grade error handling
- Performance benchmarks and optimization

---

**Document Version:** 0.1
**Last Updated:** 2025-11-14
**Status:** Initial Draft

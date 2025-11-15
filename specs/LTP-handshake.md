# LTP Handshake Specification v0.1

## 1. Overview

The LTP handshake establishes a **liminal thread session** between client and server. It negotiates protocol version, exchanges identification, and sets session parameters.

**Key Points:**
- Two-message exchange: `handshake_init` (client) → `handshake_ack` (server)
- Establishes `thread_id` (persistent) and `session_id` (connection-specific)
- No cryptographic verification in v0.1 (structure only)
- Extensible for future security enhancements

## 2. Handshake Flow

```
┌────────┐                                 ┌────────┐
│ Client │                                 │ Server │
└───┬────┘                                 └───┬────┘
    │                                          │
    │         WebSocket Connection             │
    │─────────────────────────────────────────→│
    │                                          │
    │         handshake_init                   │
    │─────────────────────────────────────────→│
    │                                          │
    │                                   [Validate Client]
    │                                   [Create Thread ID]
    │                                   [Create Session ID]
    │                                          │
    │         handshake_ack                    │
    │←─────────────────────────────────────────│
    │                                          │
    │    [Thread Session Established]          │
    │                                          │
    │         Regular LTP Messages             │
    │←────────────────────────────────────────→│
```

## 3. Message Specifications

### 3.1 handshake_init (Client → Server)

Initiates the liminal thread session.

**Format:**

```json
{
  "type": "handshake_init",
  "ltp_version": "0.1",
  "client_id": "string",
  "device_fingerprint": "string",
  "intent": "resonant_link",
  "capabilities": ["state-update", "events"],
  "metadata": {
    "sdk_version": "0.1.0",
    "platform": "web|ios|android|desktop"
  }
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"handshake_init"` |
| `ltp_version` | string | Yes | LTP protocol version (e.g., `"0.1"`) |
| `client_id` | string | Yes | Unique client identifier (UUID or custom) |
| `device_fingerprint` | string | No | Device identification (not verified in v0.1) |
| `intent` | string | No | Declared intent (e.g., `"resonant_link"`, `"data_sync"`) |
| `capabilities` | array | No | Client capabilities (e.g., `["state-update", "events"]`) |
| `metadata` | object | No | Additional client metadata |

**Example:**

```json
{
  "type": "handshake_init",
  "ltp_version": "0.1",
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "device_fingerprint": "web-chrome-119-macos",
  "intent": "resonant_link",
  "capabilities": ["state-update", "events", "ping-pong"],
  "metadata": {
    "sdk_version": "0.1.0",
    "platform": "web"
  }
}
```

### 3.2 handshake_ack (Server → Client)

Acknowledges the handshake and provides session identifiers.

**Format:**

```json
{
  "type": "handshake_ack",
  "ltp_version": "0.1",
  "thread_id": "uuid",
  "session_id": "uuid",
  "server_capabilities": ["string"],
  "heartbeat_interval_ms": 15000,
  "metadata": {
    "server_version": "0.1.0",
    "region": "us-west-2"
  }
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"handshake_ack"` |
| `ltp_version` | string | Yes | LTP protocol version server will use |
| `thread_id` | string | Yes | UUID for the liminal thread (persistent across reconnects) |
| `session_id` | string | Yes | UUID for this specific connection instance |
| `server_capabilities` | array | Yes | Server capabilities (e.g., `["basic-state-update", "ping-pong"]`) |
| `heartbeat_interval_ms` | number | Yes | Milliseconds between expected `ping` messages |
| `metadata` | object | No | Additional server metadata |

**Example:**

```json
{
  "type": "handshake_ack",
  "ltp_version": "0.1",
  "thread_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "session_id": "a8f5f167-d5a1-4c42-9e12-3d8f72e6b5c1",
  "server_capabilities": ["basic-state-update", "ping-pong", "events"],
  "heartbeat_interval_ms": 15000,
  "metadata": {
    "server_version": "0.1.0",
    "region": "us-west-2"
  }
}
```

## 4. Handshake Validation

### 4.1 Server Validation Steps

When server receives `handshake_init`:

1. **Validate Structure:**
   - Check required fields are present
   - Verify `type === "handshake_init"`

2. **Check Protocol Version:**
   - If `ltp_version` is unsupported, send error:
     ```json
     {
       "type": "error",
       "error_code": "UNSUPPORTED_VERSION",
       "error_message": "LTP version 0.1 required",
       "supported_versions": ["0.1"]
     }
     ```

3. **Validate Client ID:**
   - In v0.1: accept any non-empty string
   - Future: verify against registry, check authentication

4. **Generate IDs:**
   - Create new `thread_id` (UUID v4)
   - Create new `session_id` (UUID v4)

5. **Send `handshake_ack`**

### 4.2 Client Validation Steps

When client receives `handshake_ack`:

1. **Validate Structure:**
   - Check required fields are present
   - Verify `type === "handshake_ack"`

2. **Store Session IDs:**
   - Save `thread_id` for potential reconnection
   - Save `session_id` for current session
   - All subsequent messages MUST include these IDs

3. **Configure Heartbeat:**
   - Set up `ping` timer based on `heartbeat_interval_ms`

4. **Transition to Active State:**
   - Begin sending regular LTP messages

## 5. Error Cases

### 5.1 Malformed handshake_init

**Server Response:**

```json
{
  "type": "error",
  "error_code": "MALFORMED_HANDSHAKE",
  "error_message": "Missing required field: ltp_version",
  "timestamp": 1731600000
}
```

Server SHOULD close WebSocket connection after sending error.

### 5.2 Unsupported Version

**Server Response:**

```json
{
  "type": "error",
  "error_code": "UNSUPPORTED_VERSION",
  "error_message": "Server requires LTP v0.1",
  "supported_versions": ["0.1"],
  "timestamp": 1731600000
}
```

### 5.3 Client ID Rejected (Future)

```json
{
  "type": "error",
  "error_code": "INVALID_CLIENT_ID",
  "error_message": "Client ID not recognized or unauthorized",
  "timestamp": 1731600000
}
```

## 6. Reconnection (Future)

### 6.1 Resume Existing Thread

In future versions, client may reconnect with existing `thread_id`:

```json
{
  "type": "handshake_init",
  "ltp_version": "0.1",
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "thread_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "intent": "resume"
}
```

Server MAY restore thread context and respond with:

```json
{
  "type": "handshake_ack",
  "ltp_version": "0.1",
  "thread_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "session_id": "NEW-SESSION-ID",
  "resumed": true,
  "last_message_id": "xyz123"
}
```

**Note:** v0.1 does NOT implement thread resumption. All connections create new threads.

## 7. Security Considerations (v0.1)

### 7.1 No Authentication

v0.1 handshake does NOT provide:
- Client authentication
- Server authentication
- Message integrity verification

### 7.2 Transport Security

MUST use:
- WSS (WebSocket Secure) over TLS 1.3+
- Valid TLS certificates

### 7.3 Future Cryptographic Handshake

v0.2+ will add:

```json
{
  "type": "handshake_init",
  "ltp_version": "0.2",
  "client_id": "...",
  "crypto": {
    "public_key": "base64-encoded-ed25519-public-key",
    "key_exchange": "x25519",
    "challenge": "random-nonce"
  }
}
```

Server responds with:

```json
{
  "type": "handshake_ack",
  "thread_id": "...",
  "session_id": "...",
  "crypto": {
    "public_key": "server-public-key",
    "challenge_response": "signed-challenge",
    "session_key": "encrypted-session-key"
  }
}
```

## 8. Implementation Checklist

A compliant LTP v0.1 handshake implementation MUST:

- [ ] Send/receive `handshake_init` with all required fields
- [ ] Send/receive `handshake_ack` with all required fields
- [ ] Generate valid UUIDs for `thread_id` and `session_id`
- [ ] Validate `ltp_version === "0.1"`
- [ ] Handle version mismatch errors gracefully
- [ ] Store session IDs for use in subsequent messages
- [ ] Configure heartbeat based on `heartbeat_interval_ms`

MAY implement:
- Custom `intent` values
- Additional `metadata` fields
- Client capability negotiation

## 9. Examples

### 9.1 Successful Handshake (Minimal)

**Client sends:**
```json
{
  "type": "handshake_init",
  "ltp_version": "0.1",
  "client_id": "client-123"
}
```

**Server responds:**
```json
{
  "type": "handshake_ack",
  "ltp_version": "0.1",
  "thread_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "session_id": "a8f5f167-d5a1-4c42-9e12-3d8f72e6b5c1",
  "server_capabilities": ["ping-pong"],
  "heartbeat_interval_ms": 30000
}
```

### 9.2 Successful Handshake (Full)

**Client sends:**
```json
{
  "type": "handshake_init",
  "ltp_version": "0.1",
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "device_fingerprint": "ios-17-iphone15",
  "intent": "resonant_link",
  "capabilities": ["state-update", "events", "ping-pong"],
  "metadata": {
    "sdk_version": "0.1.0",
    "platform": "ios",
    "app_version": "1.0.0"
  }
}
```

**Server responds:**
```json
{
  "type": "handshake_ack",
  "ltp_version": "0.1",
  "thread_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "session_id": "a8f5f167-d5a1-4c42-9e12-3d8f72e6b5c1",
  "server_capabilities": ["basic-state-update", "ping-pong", "events", "lri-integration"],
  "heartbeat_interval_ms": 15000,
  "metadata": {
    "server_version": "0.1.0",
    "region": "us-east-1",
    "lri_enabled": true
  }
}
```

---

**Document Version:** 0.1
**Last Updated:** 2025-11-14
**Status:** Initial Draft

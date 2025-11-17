# LTP Handshake Specification v0.2

## 1. Overview

The LTP handshake establishes a **liminal thread session** between client and server. It negotiates protocol version, exchanges identification, and sets session parameters.

**Key Points:**
- Two handshake entry points:
  - `handshake_init` (client) → `handshake_ack` (server) for brand new threads.
  - `handshake_resume` (client) → `handshake_ack` or `handshake_reject` for rejoining an existing thread.
- Establishes `thread_id` (persistent) and `session_id` (connection-specific).
- Still no cryptographic verification, but hooks (`nonce`, `signature`) exist for v0.3+.
- Extensible for future security enhancements.

## 2. Handshake Flow

```
┌────────┐                                 ┌────────┐
│ Client │                                 │ Server │
└───┬────┘                                 └───┬────┘
    │                                          │
    │         WebSocket Connection             │
    │─────────────────────────────────────────→│
    │                                          │
    │         handshake_init / resume          │
    │─────────────────────────────────────────→│
    │                                          │
    │                                   [Validate Client]
    │                                   [Create Thread ID]
    │                                   [Create Session ID]
    │                                          │
    │     handshake_ack (resumed? true:false)  │
    │←─────────────────────────────────────────│
    │                                          │
    │     or handshake_reject (resume only)    │
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
  "ltp_version": "0.2",
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
| `ltp_version` | string | Yes | LTP protocol version (e.g., `"0.2"`) |
| `client_id` | string | Yes | Unique client identifier (UUID or custom) |
| `device_fingerprint` | string | No | Device identification (not verified in v0.1) |
| `intent` | string | No | Declared intent (e.g., `"resonant_link"`, `"data_sync"`) |
| `capabilities` | array | No | Client capabilities (e.g., `["state-update", "events"]`) |
| `metadata` | object | No | Additional client metadata |

**Example:**

```json
{
  "type": "handshake_init",
  "ltp_version": "0.2",
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

### 3.2 handshake_resume (Client → Server)

Attempts to re-enter an existing liminal thread when the client already knows its `thread_id`.

**Format:**

```json
{
  "type": "handshake_resume",
  "ltp_version": "0.2",
  "client_id": "android-liminal-001",
  "thread_id": "existing-thread-uuid",
  "resume_reason": "app_reconnect"
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"handshake_resume"` |
| `ltp_version` | string | Yes | Protocol version supported by the client |
| `client_id` | string | Yes | Same identifier used during the original session |
| `thread_id` | string | Yes | Previously issued `thread_id` |
| `resume_reason` | string | No | Free-form hint (`"app_reconnect"`, `"network_flap"`, etc.) |

Clients SHOULD attempt `handshake_resume` whenever a stored `thread_id` exists. If the server cannot find the thread it MUST send `handshake_reject` so the client can fall back to initialization.

### 3.3 handshake_ack (Server → Client)

Acknowledges the handshake and provides session identifiers.

**Format:**

```json
{
  "type": "handshake_ack",
  "ltp_version": "0.2",
  "thread_id": "uuid",
  "session_id": "uuid",
  "server_capabilities": ["string"],
  "heartbeat_interval_ms": 15000,
  "resumed": false,
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
| `resumed` | boolean | No | Indicates whether the handshake reused an existing thread |
| `metadata` | object | No | Additional server metadata |

**Example:**

```json
{
  "type": "handshake_ack",
  "ltp_version": "0.2",
  "thread_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "session_id": "a8f5f167-d5a1-4c42-9e12-3d8f72e6b5c1",
  "server_capabilities": ["basic-state-update", "ping-pong", "events"],
  "heartbeat_interval_ms": 15000,
  "resumed": false,
  "metadata": {
    "server_version": "0.1.0",
    "region": "us-west-2"
  }
}
```

### 3.4 handshake_reject (Server → Client)

Sent only when a `handshake_resume` cannot be fulfilled.

```json
{
  "type": "handshake_reject",
  "ltp_version": "0.2",
  "reason": "thread_not_found",
  "suggest_new": true
}
```

`reason` SHOULD be one of: `thread_not_found`, `version_mismatch`, `forbidden`, or an implementation-specific string. `suggest_new` hints whether the client should immediately call `handshake_init`.

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
       "error_message": "LTP version 0.2 required",
       "supported_versions": ["0.2"]
     }
     ```

3. **Validate Client ID:**
   - In v0.2 skeleton: accept any non-empty string
   - Future: verify against registry, check authentication

4. **Generate IDs:**
   - Create new `thread_id` (UUID v4)
   - Create new `session_id` (UUID v4)

5. **Send `handshake_ack` with `resumed: false`**

When server receives `handshake_resume`:

1. **Validate Structure & Version.** Same checks as `handshake_init`.
2. **Look Up Thread.** If found, mint a fresh `session_id`, update tracking metadata, and respond with `handshake_ack` (`resumed: true`).
3. **Reject If Missing.** Respond with `handshake_reject` (`reason: "thread_not_found"`, `suggest_new: true`).

### 4.2 Client Validation Steps

When client receives `handshake_ack`:

1. **Validate Structure:**
   - Check required fields are present
   - Verify `type === "handshake_ack"`

2. **Store Session IDs:**
   - Save `thread_id` for potential reconnection (even when `resumed: true`)
   - Save `session_id` for current session
   - All subsequent messages MUST include these IDs

3. **Configure Heartbeat:**
   - Set up `ping` timer based on `heartbeat_interval_ms`

4. **Transition to Active State:**
   - Begin sending regular LTP messages

## 5. When to use `handshake_init` vs `handshake_resume`

- **Use `handshake_init`** when the client has never connected before or lacks a stored `thread_id` (e.g., fresh install, manual reset).
- **Use `handshake_resume`** whenever a `thread_id` is persisted. Clients SHOULD attempt resume first to keep the liminal context intact. If the server responds with `handshake_reject`, immediately retry with `handshake_init`.

## 6. Error Cases

### 6.1 Malformed handshake

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

### 6.2 Unsupported Version

**Server Response:**

```json
{
  "type": "error",
  "error_code": "UNSUPPORTED_VERSION",
  "error_message": "Server requires LTP v0.2",
  "supported_versions": ["0.2"],
  "timestamp": 1731600000
}
```

### 6.3 Client ID Rejected (Future)

```json
{
  "type": "error",
  "error_code": "INVALID_CLIENT_ID",
  "error_message": "Client ID not recognized or unauthorized",
  "timestamp": 1731600000
}
```

## 6.4 Resume-specific Errors

Servers MAY send structured errors (e.g., `handshake_reject`) for resume attempts that fail validation. Clients SHOULD treat any rejection as a cue to restart with `handshake_init`.

## 7. Security Considerations (v0.2 skeleton)

### 7.1 No Authentication

The v0.2 handshake still does NOT provide:
- Client authentication
- Server authentication
- Message integrity verification

### 7.2 Transport Security

MUST use:
- WSS (WebSocket Secure) over TLS 1.3+
- Valid TLS certificates

### 7.3 Future Cryptographic Handshake

The new `nonce` and `signature` fields in the message envelope are reserved for v0.3+. Until then, deployments MUST rely on TLS/WSS for transport security and SHOULD monitor for replay attempts at the application layer.

## 8. Implementation Checklist

A compliant LTP v0.2 handshake implementation MUST:

- [ ] Send/receive `handshake_init` for new threads
- [ ] Attempt `handshake_resume` when `thread_id` is known
- [ ] Handle `handshake_ack` with `resumed` flag and persist IDs
- [ ] Handle `handshake_reject` and fall back to init
- [ ] Generate valid UUIDs for `thread_id`/`session_id`
- [ ] Validate `ltp_version === "0.2"`
- [ ] Configure heartbeat timers from `heartbeat_interval_ms`

MAY implement:
- Custom `resume_reason` semantics
- Additional `metadata` fields
- Client capability negotiation

## 9. Examples

### 9.1 Successful Handshake (Minimal)

**Client sends:**
```json
{
  "type": "handshake_init",
  "ltp_version": "0.2",
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

# LTP API Reference

**Version:** 0.3  
**Last Updated:** 2025-01-15

Complete API reference for LTP (Liminal Thread Protocol) SDKs across all supported languages.

---

## Table of Contents

1. [JavaScript/TypeScript API](#javascripttypescript-api)
2. [Python API](#python-api)
3. [Elixir API](#elixir-api)
4. [Rust API](#rust-api)
5. [Common Patterns](#common-patterns)

---

## JavaScript/TypeScript API

### LtpClient

#### Constructor

```typescript
new LtpClient(
  url: string,
  options?: LtpClientOptions,
  events?: LtpClientEvents
)
```

**Parameters:**

- `url` (string, required): WebSocket URL (ws:// or wss://)
- `options` (LtpClientOptions, optional): Client configuration
- `events` (LtpClientEvents, optional): Event handlers

**LtpClientOptions:**

```typescript
interface LtpClientOptions {
  clientId?: string;
  deviceFingerprint?: string;
  intent?: string;
  capabilities?: string[];
  defaultContextTag?: string;
  defaultAffect?: LtpAffect;
  metadata?: Record<string, unknown>;
  storage?: LtpStorage;
  reconnect?: ReconnectStrategy;
  heartbeat?: HeartbeatOptions;
  codec?: LtpCodec;
  preferredEncoding?: ContentEncoding;
  logger?: LtpLogger;
}
```

**Example:**

```typescript
const client = new LtpClient('wss://ltp.example.com', {
  clientId: 'my-client-1',
  defaultContextTag: 'evening_reflection',
  heartbeat: {
    intervalMs: 30000,
    timeoutMs: 90000
  }
});
```

#### Methods

##### `connect(): Promise<void>`

Establishes WebSocket connection and performs handshake.

```typescript
await client.connect();
```

##### `disconnect(): void`

Closes the connection gracefully.

```typescript
client.disconnect();
```

##### `sendStateUpdate(payload, options?): void`

Sends a state update message.

```typescript
client.sendStateUpdate({
  kind: 'affect_log_v1',
  data: [
    { t: 1, valence: 0.2, arousal: -0.1 }
  ]
}, {
  affect: { valence: 0.3, arousal: -0.2 },
  contextTag: 'custom_context'
});
```

**Parameters:**

- `payload` (StateUpdatePayload): State update payload
- `options` (optional): Metadata overrides

##### `sendEvent(eventType, data, options?): void`

Sends an event message.

```typescript
client.sendEvent('user_action', {
  action: 'button_click',
  target: 'explore_mode'
}, {
  contextTag: 'focus_session'
});
```

**Parameters:**

- `eventType` (string): Event type identifier
- `data` (Record<string, unknown>): Event data
- `options` (optional): Metadata overrides

##### `sendPing(): void`

Manually sends a ping message (usually handled automatically).

```typescript
client.sendPing();
```

##### `getThreadId(): string | null`

Returns current thread ID.

```typescript
const threadId = client.getThreadId();
```

##### `getSessionId(): string | null`

Returns current session ID.

```typescript
const sessionId = client.getSessionId();
```

#### Events

```typescript
interface LtpClientEvents {
  onConnected?: (threadId: string, sessionId: string) => void;
  onDisconnected?: () => void;
  onError?: (error: ErrorPayload) => void;
  onStateUpdate?: (payload: StateUpdatePayload) => void;
  onEvent?: (payload: EventPayload) => void;
  onPong?: () => void;
  onMessage?: (message: LtpMessage) => void;
  onPermanentFailure?: (error: Error | string) => void;
}
```

**Example:**

```typescript
const client = new LtpClient(url, options, {
  onConnected: (threadId, sessionId) => {
    console.log(`Connected: ${threadId}/${sessionId}`);
  },
  onStateUpdate: (payload) => {
    console.log('State update:', payload);
  },
  onError: (error) => {
    console.error('Error:', error.error_code, error.error_message);
  }
});
```

---

## Python API

### LtpClient

#### Constructor

```python
LtpClient(
    url: str,
    client_id: Optional[str] = None,
    device_fingerprint: Optional[str] = None,
    intent: str = "resonant_link",
    capabilities: Optional[List[str]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    default_context_tag: Optional[str] = None,
    default_affect: Optional[Dict[str, float]] = None,
    storage: Optional[ThreadStorage] = None,
    storage_path: Optional[str] = None,
    reconnect_strategy: Optional[Dict[str, int]] = None,
    heartbeat_options: Optional[Dict[str, Any]] = None,
)
```

**Example:**

```python
client = LtpClient(
    url="wss://ltp.example.com",
    client_id="python-client-1",
    default_context_tag="evening_reflection",
    heartbeat_options={
        "enabled": True,
        "interval_ms": 30000,
        "timeout_ms": 90000
    }
)
```

#### Methods

##### `async connect() -> None`

Establishes WebSocket connection and performs handshake.

```python
await client.connect()
```

##### `disconnect() -> None`

Closes the connection gracefully.

```python
client.disconnect()
```

##### `async send_state_update(kind: str, data: Dict[str, Any]) -> None`

Sends a state update message.

```python
await client.send_state_update(
    kind="affect_log_v1",
    data=[
        {"t": 1, "valence": 0.2, "arousal": -0.1}
    ]
)
```

##### `async send_event(event_type: str, data: Dict[str, Any]) -> None`

Sends an event message.

```python
await client.send_event(
    event_type="user_action",
    data={"action": "button_click", "target": "explore_mode"}
)
```

#### Event Handlers

```python
client.on_connected = lambda thread_id, session_id: print(f"Connected: {thread_id}")
client.on_state_update = lambda payload: print(f"State update: {payload}")
client.on_error = lambda error: print(f"Error: {error.error_code}")
```

---

## Elixir API

### LTP.Client

#### start_link/1

Starts the LTP client GenServer.

```elixir
{:ok, pid} = LTP.Client.start_link(%{
  url: "wss://ltp.example.com",
  client_id: "elixir-client-1",
  default_context_tag: "evening_reflection",
  heartbeat_interval_ms: 30_000,
  heartbeat_timeout_ms: 90_000
})
```

**Options:**

```elixir
%{
  url: String.t(),                    # required
  client_id: String.t(),              # required
  device_fingerprint: String.t(),      # optional
  intent: String.t(),                 # optional, default: "resonant_link"
  capabilities: [String.t()],         # optional
  metadata: map(),                    # optional
  default_context_tag: String.t(),     # optional
  default_affect: map(),              # optional
  heartbeat_interval_ms: integer(),    # optional, default: 15000
  heartbeat_timeout_ms: integer(),     # optional, default: 45000
  reconnect: %{                        # optional
    max_retries: integer(),            # default: 5
    base_delay_ms: integer(),          # default: 1000
    max_delay_ms: integer()            # default: 30000
  }
}
```

#### send_state_update/3

Sends a state update message.

```elixir
:ok = LTP.Client.send_state_update(pid, %{
  kind: "affect_log_v1",
  data: [
    %{t: 1, valence: 0.2, arousal: -0.1}
  ]
}, context_tag: "custom_context")
```

#### send_event/4

Sends an event message.

```elixir
:ok = LTP.Client.send_event(pid, "user_action", %{
  action: "button_click",
  target: "explore_mode"
}, context_tag: "focus_session")
```

#### get_thread_id/1

Returns current thread ID.

```elixir
thread_id = LTP.Client.get_thread_id(pid)
```

#### get_session_id/1

Returns current session ID.

```elixir
session_id = LTP.Client.get_session_id(pid)
```

#### stop/1

Stops the client process.

```elixir
:ok = LTP.Client.stop(pid)
```

#### Event Messages

The client sends messages to the calling process:

```elixir
receive do
  {:ltp_connected, thread_id, session_id} ->
    IO.puts("Connected: #{thread_id}")
  
  {:ltp_state_update, payload} ->
    IO.puts("State update: #{inspect(payload)}")
  
  {:ltp_event, payload} ->
    IO.puts("Event: #{inspect(payload)}")
  
  {:ltp_error, error} ->
    IO.puts("Error: #{inspect(error)}")
  
  {:ltp_permanent_failure, reason} ->
    IO.puts("Permanent failure: #{reason}")
end
```

---

## Rust API

### LtpClient

#### Constructor

```rust
let mut client = LtpClient::new(
    url: impl Into<String>,
    client_id: impl Into<String>
)
```

**Builder methods:**

```rust
let mut client = LtpClient::new("wss://ltp.example.com", "rust-client-1")
    .with_device_fingerprint("device-123")
    .with_intent("resonant_link")
    .with_default_context_tag("evening_reflection")
    .with_heartbeat_interval(30_000)
    .with_heartbeat_timeout(90_000);
```

#### Methods

##### `async fn connect(&mut self) -> Result<()>`

Establishes WebSocket connection and performs handshake.

```rust
client.connect().await?;
```

##### `async fn send_state_update<T: Serialize>(&mut self, kind: &str, data: T) -> Result<()>`

Sends a state update message.

```rust
use serde_json::json;

client.send_state_update(
    "affect_log_v1",
    vec![
        json!({"t": 1, "valence": 0.2, "arousal": -0.1})
    ]
).await?;
```

##### `async fn send_event<T: Serialize>(&mut self, event_type: &str, data: T) -> Result<()>`

Sends an event message.

```rust
client.send_event(
    "user_action",
    json!({"action": "button_click", "target": "explore_mode"})
).await?;
```

##### `fn thread_id(&self) -> Option<&String>`

Returns current thread ID.

```rust
if let Some(thread_id) = client.thread_id() {
    println!("Thread ID: {}", thread_id);
}
```

##### `fn session_id(&self) -> Option<&String>`

Returns current session ID.

```rust
if let Some(session_id) = client.session_id() {
    println!("Session ID: {}", session_id);
}
```

---

## Common Patterns

### 1. Connection with Retry

**JavaScript:**

```typescript
async function connectWithRetry(client: LtpClient, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await client.connect();
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

**Python:**

```python
async def connect_with_retry(client, max_retries=5):
    for i in range(max_retries):
        try:
            await client.connect()
            return
        except Exception as e:
            if i == max_retries - 1:
                raise
            await asyncio.sleep(1 * (i + 1))
```

### 2. Sending Batch Updates

**JavaScript:**

```typescript
const updates = [
  { kind: 'affect_log', data: [...] },
  { kind: 'event_log', data: [...] }
];

for (const update of updates) {
  client.sendStateUpdate(update);
  await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit
}
```

**Python:**

```python
updates = [
    {"kind": "affect_log", "data": [...]},
    {"kind": "event_log", "data": [...]}
]

for update in updates:
    await client.send_state_update(**update)
    await asyncio.sleep(0.1)  # Rate limit
```

### 3. Error Handling

**JavaScript:**

```typescript
const client = new LtpClient(url, options, {
  onError: (error) => {
    console.error(`LTP Error [${error.error_code}]: ${error.error_message}`);
    if (error.details) {
      console.error('Details:', error.details);
    }
  },
  onPermanentFailure: (reason) => {
    console.error('Permanent failure:', reason);
    // Implement recovery logic
  }
});
```

**Python:**

```python
def on_error(error):
    print(f"LTP Error [{error.error_code}]: {error.error_message}")
    if error.details:
        print(f"Details: {error.details}")

client.on_error = on_error
```

### 4. Thread Continuity

**JavaScript:**

```typescript
// Save thread_id on connect
client.onConnected = (threadId, sessionId) => {
  localStorage.setItem('ltp_thread_id', threadId);
  localStorage.setItem('ltp_session_id', sessionId);
};

// Resume on reconnect
const savedThreadId = localStorage.getItem('ltp_thread_id');
if (savedThreadId) {
  // Thread will be resumed automatically
}
```

**Python:**

```python
# Thread persistence is handled automatically via ThreadStorage
# Default storage path: ~/.ltp_client.json

# Custom storage path
client = LtpClient(
    url=url,
    client_id=client_id,
    storage_path="/custom/path/ltp_storage.json"
)
```

---

## Type Definitions

### ContentEncoding

```typescript
type ContentEncoding = 'json' | 'toon';
```

### LtpAffect

```typescript
interface LtpAffect {
  valence: number;  // -1 to 1
  arousal: number; // -1 to 1
}
```

### StateUpdatePayload

```typescript
interface StateUpdatePayload {
  kind: string;
  data: unknown;
}
```

### EventPayload

```typescript
interface EventPayload {
  event_type: string;
  data: Record<string, unknown>;
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `HANDSHAKE_FAILED` | Handshake negotiation failed |
| `HANDSHAKE_REJECTED` | Server rejected handshake |
| `THREAD_NOT_FOUND` | Thread ID not found on resume |
| `INVALID_MESSAGE` | Message format invalid |
| `RATE_LIMITED` | Rate limit exceeded |
| `SERVER_ERROR` | Server-side error |
| `CONNECTION_CLOSED` | Connection closed unexpectedly |
| `TIMEOUT` | Operation timed out |

---

## Best Practices

1. **Always use WSS in production** - Never use unencrypted WS connections
2. **Handle reconnections** - Implement proper reconnection logic
3. **Monitor heartbeat** - Ensure heartbeat is working correctly
4. **Validate data** - Validate all data before sending
5. **Rate limiting** - Implement client-side rate limiting
6. **Error handling** - Always handle errors gracefully
7. **Thread persistence** - Save thread_id for continuity
8. **Logging** - Use structured logging for debugging

---

**For more examples, see the [examples directory](../examples/).**


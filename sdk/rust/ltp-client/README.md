# LTP Rust Client SDK

Rust client SDK for LTP (Liminal Thread Protocol) v0.1.

## Overview

LTP (Liminal Thread Protocol) is a transport protocol built on top of WebSocket/TCP, designed to maintain context, intent, and inner state across communication sessions. This SDK provides a fast, safe Rust client implementation.

## Features

- ✅ WebSocket connection management
- ✅ Handshake init/resume support
- ✅ Basic heartbeat (ping/pong)
- ✅ State updates and events
- ✅ Thread and session continuity
- ✅ Async/await with Tokio
- ✅ Type-safe with Serde

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
ltp-client = { path = "../sdk/rust/ltp-client" }
```

Or if published to crates.io:

```toml
ltp-client = "0.1"
```

## Quick Start

```rust
use ltp_client::LtpClient;
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = LtpClient::new("ws://localhost:8080", "my-client-1")
        .with_default_context_tag("evening_reflection")
        .with_heartbeat_interval(15_000)
        .with_heartbeat_timeout(45_000);

    client.connect().await?;

    // Send a state update
    client.send_state_update(
        "affect_log_v1",
        vec![
            json!({"t": 1, "valence": 0.2, "arousal": -0.1}),
            json!({"t": 2, "valence": 0.3, "arousal": -0.2}),
        ],
    ).await?;

    // Send an event
    client.send_event(
        "user_action",
        json!({
            "action": "button_click",
            "target": "explore_mode"
        }),
    ).await?;

    Ok(())
}
```

## API

### Creating a Client

```rust
let mut client = LtpClient::new(url, client_id)
    .with_device_fingerprint("device-123")
    .with_intent("resonant_link")
    .with_default_context_tag("my_context")
    .with_heartbeat_interval(15_000)
    .with_heartbeat_timeout(45_000);
```

### Connecting

```rust
client.connect().await?;
```

### Sending Messages

```rust
// State update
client.send_state_update(kind, data).await?;

// Event
client.send_event(event_type, data).await?;
```

### Getting Connection Info

```rust
let thread_id = client.thread_id();
let session_id = client.session_id();
```

## Configuration

| Method | Type | Default | Description |
|--------|------|---------|-------------|
| `with_device_fingerprint` | `String` | `None` | Device fingerprint |
| `with_intent` | `String` | `"resonant_link"` | Connection intent |
| `with_default_context_tag` | `String` | `None` | Default context tag |
| `with_heartbeat_interval` | `u64` | `15_000` | Heartbeat interval (ms) |
| `with_heartbeat_timeout` | `u64` | `45_000` | Heartbeat timeout (ms) |

## Examples

See `examples/minimal_client.rs` for a complete example.

Run it with:

```bash
cd sdk/rust/ltp-client
cargo run --example minimal_client
```

## Building

```bash
cd sdk/rust/ltp-client
cargo build
```

## Testing

```bash
cargo test
```

## Version

Current version: **0.1.0**

## License

MIT

## Links

- [LTP Protocol Specification](../../specs/)
- [JavaScript SDK](../../js/)
- [Python SDK](../../python/)
- [Elixir SDK](../../elixir/)


# LTP Rust Server Example

Example LTP server implementation in Rust using tokio-tungstenite.

## Features

- Handshake init/resume support
- Thread and session management
- Ping/pong heartbeat handling
- State update and event processing
- Async/await with Tokio

## Running

```bash
cd examples/rust-server
cargo run
```

Server will start on `ws://localhost:8080`

## Usage

Connect with any LTP client:

```rust
use ltp_client::LtpClient;

let mut client = LtpClient::new("ws://localhost:8080", "test-client");
client.connect().await?;
```


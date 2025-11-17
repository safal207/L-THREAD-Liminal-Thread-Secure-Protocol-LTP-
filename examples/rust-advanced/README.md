# Advanced Rust LTP Examples

Production-ready Rust examples demonstrating advanced patterns and best practices for the LTP Rust SDK.

## Examples

### 1. Production Client (`production_client.rs`)

A production-ready client wrapper with:
- **Error handling**: Comprehensive error handling with Result types
- **Metrics collection**: Track messages, errors, uptime
- **Batch operations**: Efficient batch sending
- **Shared state**: Thread-safe state management with Arc<Mutex<>>
- **Graceful shutdown**: Clean disconnection

**Usage:**
```bash
cd examples/rust-advanced
cargo run --example production_client
```

**Features:**
- Metrics collection and reporting
- Batch state update sending
- Large affect log batches
- Thread-safe operations
- Error tracking

### 2. Concurrent Client (`concurrent_client.rs`)

Demonstrates concurrent operations:
- **Tokio tasks**: Spawn multiple concurrent tasks
- **Shared state**: Safe concurrent access with Arc<Mutex<>>
- **Error handling**: Handle errors in async context
- **Task coordination**: Wait for all tasks to complete

**Usage:**
```bash
cd examples/rust-advanced
cargo run --example concurrent_client
```

**Features:**
- Concurrent message sending
- Task spawning with tokio
- Shared state management
- Error handling in async context

## Running Examples

1. **Start an LTP server** (see `examples/js-minimal-server`):
   ```bash
   cd examples/js-minimal-server
   npm install
   node index.js
   ```

2. **Run an example**:
   ```bash
   cd examples/rust-advanced
   cargo run --example production_client
   # or
   cargo run --example concurrent_client
   ```

## Best Practices Demonstrated

### Error Handling
- Use Result<T, E> for error handling
- Propagate errors with `?` operator
- Handle errors at appropriate levels

### Async/Await
- Use tokio for async runtime
- Properly handle async errors
- Use Arc<Mutex<>> for shared state

### Resource Management
- Use RAII for resource management
- Clean up resources in drop
- Graceful shutdown

### Concurrency
- Use Arc<Mutex<>> for shared state
- Spawn tasks with tokio::spawn
- Coordinate tasks with join! or select!

## Integration Patterns

### With Actix Web
```rust
use actix_web::{web, App, HttpServer, Result};
use ltp_client::LtpClient;

struct AppState {
    ltp_client: Arc<Mutex<LtpClient>>,
}

async fn send_event(
    state: web::Data<AppState>,
    payload: web::Json<serde_json::Value>,
) -> Result<String> {
    let mut client = state.ltp_client.lock().await;
    client.send_state_update("event", payload.into_inner()).await?;
    Ok("Event sent".to_string())
}
```

### With Tokio Runtime
```rust
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = ProductionLtpClient::new(url, client_id);
    client.connect().await?;
    
    // Spawn background task
    tokio::spawn(async move {
        loop {
            client.send_heartbeat().await?;
            tokio::time::sleep(Duration::from_secs(30)).await;
        }
    });
    
    Ok(())
}
```

### With Message Queues
```rust
use tokio::sync::mpsc;

async fn process_queue(mut rx: mpsc::Receiver<Message>) {
    let client = ProductionLtpClient::new(url, client_id);
    client.connect().await?;
    
    while let Some(message) = rx.recv().await {
        client.send_state_update("queue_message", message.payload).await?;
    }
}
```

## Next Steps

- Add custom storage backends
- Integrate with monitoring systems (Prometheus, metrics)
- Implement custom reconnection strategies
- Add authentication/authorization


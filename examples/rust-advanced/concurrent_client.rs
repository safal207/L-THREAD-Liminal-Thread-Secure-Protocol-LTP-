// LTP Concurrent Client Example (Rust)
//
// Demonstrates:
// - Concurrent operations with tokio
// - Task spawning
// - Shared state management
// - Error handling in async context

use ltp_client::LtpClient;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};

struct ConcurrentLtpClient {
    client: Arc<Mutex<LtpClient>>,
    task_count: Arc<Mutex<u32>>,
}

impl ConcurrentLtpClient {
    fn new(url: impl Into<String>, client_id: impl Into<String>) -> Self {
        Self {
            client: Arc::new(Mutex::new(
                LtpClient::new(url, client_id).with_default_context_tag("concurrent"),
            )),
            task_count: Arc::new(Mutex::new(0)),
        }
    }

    async fn connect(&self) -> Result<(), Box<dyn std::error::Error>> {
        let mut client = self.client.lock().await;
        client.connect().await?;
        println!("✓ Connected to LTP server");
        Ok(())
    }

    async fn send_concurrent_updates(&self, count: usize) -> Result<(), Box<dyn std::error::Error>> {
        let mut handles = Vec::new();

        for i in 0..count {
            let client = Arc::clone(&self.client);
            let task_count = Arc::clone(&self.task_count);

            let handle = tokio::spawn(async move {
                let mut client = client.lock().await;
                let mut count = task_count.lock().await;

                match client
                    .send_state_update(
                        "concurrent_update",
                        json!({
                            "index": i,
                            "timestamp": chrono::Utc::now().timestamp(),
                        }),
                    )
                    .await
                {
                    Ok(_) => {
                        *count += 1;
                        println!("Task {} completed", i);
                        Ok(())
                    }
                    Err(e) => {
                        eprintln!("Task {} failed: {}", i, e);
                        Err(e)
                    }
                }
            });

            handles.push(handle);
        }

        // Wait for all tasks to complete
        for handle in handles {
            handle.await??;
        }

        let count = self.task_count.lock().await;
        println!("Completed {} concurrent tasks", *count);

        Ok(())
    }

    async fn disconnect(&self) -> Result<(), Box<dyn std::error::Error>> {
        let mut client = self.client.lock().await;
        client.disconnect().await?;
        println!("Disconnected from LTP server");
        Ok(())
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = ConcurrentLtpClient::new("ws://localhost:8080", "concurrent-rust-example-001");

    client.connect().await?;

    // Send concurrent updates
    println!("Sending 10 concurrent updates...");
    client.send_concurrent_updates(10).await?;

    sleep(Duration::from_secs(2)).await;

    client.disconnect().await?;

    Ok(())
}


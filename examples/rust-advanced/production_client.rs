// LTP Production-Ready Client Example (Rust)
//
// Demonstrates:
// - Error handling and recovery
// - Metrics collection
// - Batch operations
// - Structured logging
// - Graceful shutdown

use ltp_client::LtpClient;
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use tokio::time;

#[derive(Clone, Debug)]
struct ClientMetrics {
    messages_sent: u64,
    messages_received: u64,
    errors: u64,
    reconnects: u64,
    start_time: Instant,
}

impl ClientMetrics {
    fn new() -> Self {
        Self {
            messages_sent: 0,
            messages_received: 0,
            errors: 0,
            reconnects: 0,
            start_time: Instant::now(),
        }
    }

    fn to_map(&self) -> HashMap<String, String> {
        let mut map = HashMap::new();
        map.insert("messages_sent".to_string(), self.messages_sent.to_string());
        map.insert("messages_received".to_string(), self.messages_received.to_string());
        map.insert("errors".to_string(), self.errors.to_string());
        map.insert("reconnects".to_string(), self.reconnects.to_string());
        map.insert(
            "uptime_seconds".to_string(),
            self.start_time.elapsed().as_secs().to_string(),
        );
        map
    }
}

struct ProductionLtpClient {
    client: Arc<Mutex<LtpClient>>,
    metrics: Arc<Mutex<ClientMetrics>>,
    url: String,
    client_id: String,
}

impl ProductionLtpClient {
    fn new(url: impl Into<String>, client_id: impl Into<String>) -> Self {
        Self {
            client: Arc::new(Mutex::new(
                LtpClient::new(url.clone(), client_id.clone())
                    .with_default_context_tag("production"),
            )),
            metrics: Arc::new(Mutex::new(ClientMetrics::new())),
            url: url.into(),
            client_id: client_id.into(),
        }
    }

    async fn connect(&self) -> Result<(), Box<dyn std::error::Error>> {
        let mut client = self.client.lock().await;
        client.connect().await?;
        println!("✓ Connected to LTP server");
        Ok(())
    }

    async fn send_batch_state_updates(
        &self,
        updates: Vec<serde_json::Value>,
    ) -> Result<Vec<bool>, Box<dyn std::error::Error>> {
        let mut client = self.client.lock().await;
        let mut results = Vec::new();
        let mut metrics = self.metrics.lock().await;

        for update in updates {
            match client
                .send_state_update(
                    "batch_update",
                    update.clone(),
                )
                .await
            {
                Ok(_) => {
                    metrics.messages_sent += 1;
                    results.push(true);
                }
                Err(e) => {
                    metrics.errors += 1;
                    eprintln!("Failed to send update: {}", e);
                    results.push(false);
                }
            }
        }

        Ok(results)
    }

    async fn send_affect_log_batch(
        &self,
        logs: Vec<serde_json::Value>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        println!("Sending affect log batch ({} entries)", logs.len());
        let mut client = self.client.lock().await;
        let mut metrics = self.metrics.lock().await;

        client
            .send_state_update("affect_log_batch", json!(logs))
            .await?;

        metrics.messages_sent += 1;
        Ok(())
    }

    async fn get_metrics(&self) -> HashMap<String, String> {
        let metrics = self.metrics.lock().await;
        metrics.to_map()
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
    let client = ProductionLtpClient::new("ws://localhost:8080", "prod-rust-example-001");

    client.connect().await?;

    // Send a large batch of affect logs
    let affect_logs: Vec<serde_json::Value> = (1..=100)
        .map(|i| {
            json!({
                "t": i,
                "valence": 0.5 * (1.0 + (i % 10) as f64 / 10.0),
                "arousal": 0.3 * (1.0 - (i % 10) as f64 / 10.0),
                "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64 + i as i64,
            })
        })
        .collect();

    client.send_affect_log_batch(affect_logs).await?;

    // Send multiple state updates
    let updates = vec![
        json!({"kind": "system_status", "data": {"cpu": 0.5, "memory": 0.7}}),
        json!({"kind": "user_activity", "data": {"action": "login", "userId": "user123"}}),
        json!({"kind": "performance_metric", "data": {"latency": 120, "throughput": 1000}}),
    ];

    let results = client.send_batch_state_updates(updates).await?;
    let successful = results.iter().filter(|&&r| r).count();
    println!("Batch updates: {}/{} successful", successful, results.len());

    // Wait and show metrics
    time::sleep(Duration::from_secs(2)).await;

    let metrics = client.get_metrics().await;
    println!("\n=== Production Client Metrics ===");
    for (key, value) in metrics {
        println!("{}: {}", key, value);
    }

    client.disconnect().await?;

    Ok(())
}


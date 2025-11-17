use ltp_client::LtpClient;
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== LTP Rust Client Example ===\n");

    let mut client = LtpClient::new("ws://localhost:8080", "rust-example-1")
        .with_device_fingerprint("rust-example")
        .with_intent("resonant_link")
        .with_default_context_tag("evening_reflection")
        .with_heartbeat_interval(15_000)
        .with_heartbeat_timeout(45_000);

    println!("Connecting to LTP server...");
    client.connect().await?;
    println!("✓ Connected!\n");

    // Send initial state update
    println!("→ Sending initial state update...");
    client
        .send_state_update(
            "minimal",
            json!({
                "mood": "curious",
                "focus": "exploration",
                "energy_level": 0.8
            }),
        )
        .await?;
    println!("✓ State update sent\n");

    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

    // Send affect log
    println!("→ Sending affect log...");
    client
        .send_state_update(
            "affect_log_v1",
            vec![
                json!({"t": 1, "valence": 0.2, "arousal": -0.1}),
                json!({"t": 2, "valence": 0.3, "arousal": -0.2}),
                json!({"t": 3, "valence": 0.1, "arousal": 0.0}),
            ],
        )
        .await?;
    println!("✓ Affect log sent\n");

    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

    // Send event
    println!("→ Sending event...");
    client
        .send_event(
            "user_action",
            json!({
                "action": "button_click",
                "target": "explore_mode",
                "screen": "home"
            }),
        )
        .await?;
    println!("✓ Event sent\n");

    // Get connection info
    if let Some(thread_id) = client.thread_id() {
        println!("Thread ID: {}", thread_id);
    }
    if let Some(session_id) = client.session_id() {
        println!("Session ID: {}", session_id);
    }

    println!("\nExample completed. Press Ctrl+C to exit.");
    tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;

    Ok(())
}


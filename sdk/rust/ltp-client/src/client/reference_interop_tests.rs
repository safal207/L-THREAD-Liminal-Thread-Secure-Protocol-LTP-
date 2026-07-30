use super::*;
use std::env;
use std::fs;
use std::path::Path;
use tokio::time::{sleep, Duration};

const SDK: &str = "rust";
const CLIENT_ID: &str = "wp2-rust";

fn scenario_envelope(
    client: &LtpClient,
    scenario_id: &str,
    timestamp: i64,
    nonce: String,
    previous_hash: Option<String>,
    invalid_signature: bool,
) -> Result<LtpEnvelope> {
    let mut envelope =
        client.build_event_envelope("wp2", serde_json::json!({"scenario_id": scenario_id}))?;
    envelope.timestamp = timestamp;
    envelope.nonce = Some(nonce);
    envelope.prev_message_hash = previous_hash;
    let key = client.session_mac_key.as_ref().ok_or_else(|| {
        LtpError::InvalidState("reference interop requires a session MAC key".to_string())
    })?;
    envelope.signature = Some(if invalid_signature {
        "00".repeat(32)
    } else {
        crypto::sign_message(&serde_json::to_value(&envelope)?, key)?
    });
    Ok(envelope)
}

async fn send_raw(client: &mut LtpClient, envelope: &LtpEnvelope, commit: bool) -> Result<()> {
    if commit {
        client.last_sent_hash = Some(crypto::hash_envelope(&serde_json::to_value(envelope)?)?);
    }
    client.send_text(serde_json::to_string(envelope)?).await
}

#[tokio::test]
async fn reference_server_interop() {
    let url = env::var("LTP_REFERENCE_URL").expect("LTP_REFERENCE_URL");
    let output = env::var("LTP_ADAPTER_OUTPUT").expect("LTP_ADAPTER_OUTPUT");
    let secret = env::var("LTP_REFERENCE_SECRET")
        .unwrap_or_else(|_| "ltp-reference-long-term-secret".to_string());

    let mut client = LtpClient::new(url, CLIENT_ID)
        .with_secret_key(secret)
        .with_ecdh_key_exchange(true)
        .with_metadata_encryption(false);
    client.connect().await.expect("fresh handshake");
    let thread_id = client.thread_id.clone().expect("thread id");
    let session_id = client.session_id.clone().expect("session id");
    let mut actions = vec!["fresh-handshake"];

    client
        .send_event(
            "wp2",
            serde_json::json!({"scenario_id": format!("{}:business", SDK), "value": 1}),
        )
        .await
        .expect("business send");
    sleep(Duration::from_millis(250)).await;
    actions.push("business");

    client.send_ping().await.expect("ping send");
    sleep(Duration::from_millis(250)).await;
    actions.push("ping-pong");

    client.enable_metadata_encryption = true;
    client
        .send_event(
            "wp2",
            serde_json::json!({"scenario_id": format!("{}:encrypted", SDK), "value": 2}),
        )
        .await
        .expect("encrypted send");
    sleep(Duration::from_millis(250)).await;
    client.enable_metadata_encryption = false;
    actions.push("encrypted");

    let invalid = scenario_envelope(
        &client,
        &format!("{}:invalid-signature", SDK),
        now_ms(),
        client.generate_nonce().expect("nonce"),
        client.last_sent_hash.clone(),
        true,
    )
    .expect("invalid frame");
    send_raw(&mut client, &invalid, false)
        .await
        .expect("invalid send");
    sleep(Duration::from_millis(250)).await;
    actions.push("invalid-signature");

    let stale = scenario_envelope(
        &client,
        &format!("{}:stale-timestamp", SDK),
        now_ms() - 120_000,
        client.generate_nonce().expect("nonce"),
        client.last_sent_hash.clone(),
        false,
    )
    .expect("stale frame");
    send_raw(&mut client, &stale, false)
        .await
        .expect("stale send");
    sleep(Duration::from_millis(250)).await;
    actions.push("stale-timestamp");

    let replay_seed = scenario_envelope(
        &client,
        &format!("{}:replay-seed", SDK),
        now_ms(),
        client.generate_nonce().expect("nonce"),
        client.last_sent_hash.clone(),
        false,
    )
    .expect("replay seed");
    let replay_nonce = replay_seed.nonce.clone().expect("seed nonce");
    send_raw(&mut client, &replay_seed, true)
        .await
        .expect("replay seed send");
    sleep(Duration::from_millis(250)).await;

    let replay = scenario_envelope(
        &client,
        &format!("{}:replayed-nonce", SDK),
        now_ms(),
        replay_nonce,
        client.last_sent_hash.clone(),
        false,
    )
    .expect("replay frame");
    send_raw(&mut client, &replay, false)
        .await
        .expect("replay send");
    sleep(Duration::from_millis(250)).await;
    actions.push("replayed-nonce");

    let broken = scenario_envelope(
        &client,
        &format!("{}:broken-chain", SDK),
        now_ms(),
        client.generate_nonce().expect("nonce"),
        Some("deadbeef".to_string()),
        false,
    )
    .expect("broken-chain frame");
    send_raw(&mut client, &broken, false)
        .await
        .expect("broken-chain send");
    sleep(Duration::from_millis(250)).await;
    actions.push("broken-chain");

    client.connect().await.expect("same-session resume");
    assert_eq!(client.thread_id.as_deref(), Some(thread_id.as_str()));
    assert_eq!(client.session_id.as_deref(), Some(session_id.as_str()));
    actions.push("same-session-resume");

    client
        .send_event(
            "wp2",
            serde_json::json!({"scenario_id": format!("{}:post-resume", SDK), "value": 3}),
        )
        .await
        .expect("post-resume send");
    sleep(Duration::from_millis(300)).await;
    actions.push("post-resume");

    let report = serde_json::json!({
        "schema_version": 1,
        "sdk": SDK,
        "client_id": CLIENT_ID,
        "protocol_version": "0.6",
        "thread_id": thread_id,
        "session_id": session_id,
        "actions": actions,
    });
    if let Some(parent) = Path::new(&output).parent() {
        fs::create_dir_all(parent).expect("create output directory");
    }
    fs::write(
        output,
        format!("{}\n", serde_json::to_string_pretty(&report).unwrap()),
    )
    .expect("write adapter output");
}

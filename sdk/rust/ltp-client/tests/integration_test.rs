use ltp_client::crypto::{generate_hmac_nonce, hmac_sha256};
use ltp_client::types::*;
use ltp_client::LtpClient;
use regex::Regex;
use serde_json::json;

fn is_hex(s: &str) -> bool {
    !s.is_empty() && s.chars().all(|c| c.is_ascii_hexdigit())
}

#[test]
fn test_envelope_serialization() {
    let envelope = LtpEnvelope {
        r#type: "state_update".to_string(),
        thread_id: "test-thread-123".to_string(),
        session_id: Some("test-session-456".to_string()),
        timestamp: 1234567890,
        content_encoding: ContentEncoding::Json,
        payload: Payload {
            kind: "affect_log_v1".to_string(),
            data: json!([
                {"t": 1, "valence": 0.2, "arousal": -0.1},
                {"t": 2, "valence": 0.3, "arousal": -0.2}
            ]),
        },
        meta: Some(json!({
            "client_id": "test-client",
            "context_tag": "test-context"
        })),
        nonce: Some("test-nonce".to_string()),
        signature: Some("v0-placeholder".to_string()),
        prev_message_hash: None,
        encrypted_metadata: None,
        routing_tag: None,
    };

    let json_str = serde_json::to_string(&envelope).unwrap();
    assert!(json_str.contains("state_update"));
    assert!(json_str.contains("test-thread-123"));
    assert!(json_str.contains("affect_log_v1"));
}

#[test]
fn test_handshake_ack_deserialization() {
    let json_str = r#"{
        "type": "handshake_ack",
        "ltp_version": "0.3",
        "thread_id": "thread-123",
        "session_id": "session-456",
        "resumed": false,
        "heartbeat_interval_ms": 15000
    }"#;

    let ack: HandshakeAck = serde_json::from_str(json_str).unwrap();
    assert_eq!(ack.r#type, "handshake_ack");
    assert_eq!(ack.thread_id, "thread-123");
    assert_eq!(ack.session_id, "session-456");
    assert_eq!(ack.resumed, false);
    assert_eq!(ack.heartbeat_interval_ms, 15000);
}

#[test]
fn test_content_encoding_enum() {
    let json_json = r#""json""#;
    let json_encoding: ContentEncoding = serde_json::from_str(json_json).unwrap();
    assert!(matches!(json_encoding, ContentEncoding::Json));

    let toon_json = r#""toon""#;
    let toon_encoding: ContentEncoding = serde_json::from_str(toon_json).unwrap();
    assert!(matches!(toon_encoding, ContentEncoding::Toon));
}

#[test]
fn test_hmac_nonce_format_with_session_mac_key() {
    let mac_key = "test-mac-key";
    let nonce = generate_hmac_nonce(mac_key);

    let parts: Vec<&str> = nonce.split('-').collect();
    assert_eq!(parts.len(), 4, "nonce `{}` did not have four segments", nonce);
    assert_eq!(parts[0], "hmac", "nonce must start with hmac prefix");

    let random_hex = parts[1];
    assert_eq!(random_hex.len(), 32, "random hex `{}` must be 32 chars", random_hex);
    assert!(is_hex(random_hex), "random hex `{}` must be hexadecimal", random_hex);

    let timestamp_str = parts[2];
    let timestamp: i64 = timestamp_str
        .parse()
        .expect("timestamp should be numeric milliseconds");
    assert!(timestamp > 0, "timestamp should be positive");

    let hmac_prefix = parts[3];
    assert_eq!(hmac_prefix.len(), 32, "HMAC prefix `{}` must be 32 chars", hmac_prefix);
    assert!(is_hex(hmac_prefix), "HMAC prefix `{}` must be hexadecimal", hmac_prefix);

    let recomputed = hmac_sha256(&format!("{}-{}", timestamp_str, random_hex), mac_key);
    assert!(
        recomputed.starts_with(hmac_prefix),
        "HMAC prefix `{}` should match computed HMAC `{}`",
        hmac_prefix,
        recomputed
    );
}


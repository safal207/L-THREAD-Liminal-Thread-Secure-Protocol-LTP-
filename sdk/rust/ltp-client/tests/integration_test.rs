use ltp_client::types::*;
use serde_json::json;

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


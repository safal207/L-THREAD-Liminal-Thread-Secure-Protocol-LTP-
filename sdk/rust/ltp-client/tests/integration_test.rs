use ltp_client::crypto;
use ltp_client::types::*;
use ltp_client::LtpClient;
use regex::Regex;
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

#[test]
fn test_metadata_encryption_applies_and_clears_plaintext_fields() {
    let encryption_key = "7f0e6c58d4b1c3a9f2e1d0c9b8a7f6e57f0e6c58d4b1c3a9f2e1d0c9b8a7f6e5";
    let mac_key = "1b2c3d4e5f60718293a4b5c6d7e8f9011b2c3d4e5f60718293a4b5c6d7e8f901";

    let mut client = LtpClient::new("wss://example", "client-1")
        .with_metadata_encryption(true)
        .with_session_mac_key(mac_key)
        .with_session_encryption_key(encryption_key);

    let envelope = LtpEnvelope {
        r#type: "state_update".to_string(),
        thread_id: "thread-123".to_string(),
        session_id: Some("session-456".to_string()),
        timestamp: 1_700_000_000,
        content_encoding: ContentEncoding::Json,
        payload: Payload {
            kind: "affect_log_v1".to_string(),
            data: json!({"mood": "good"}),
        },
        meta: Some(json!({"client_id": "client-1"})),
        nonce: None,
        signature: None,
        prev_message_hash: None,
        encrypted_metadata: None,
        routing_tag: None,
    };

    let prepared = client
        .prepare_envelope_for_offline_send(envelope)
        .expect("metadata encryption should succeed");

    assert!(prepared.encrypted_metadata.is_some());
    assert!(prepared.routing_tag.is_some());
    assert_eq!(prepared.thread_id, "");
    assert!(prepared.session_id.is_none());
    assert_eq!(prepared.timestamp, 0);
}

#[test]
fn test_hmac_nonce_format_with_session_mac_key() {
    let mac_key = "0f0e0d0c0b0a090807060504030201000f0e0d0c0b0a09080706050403020100";
    let mut client = LtpClient::new("wss://example", "client-2").with_session_mac_key(mac_key);

    let envelope = LtpEnvelope {
        r#type: "event".to_string(),
        thread_id: "thread-abc".to_string(),
        session_id: Some("session-def".to_string()),
        timestamp: 1_700_000_100,
        content_encoding: ContentEncoding::Json,
        payload: Payload {
            kind: "test".to_string(),
            data: json!({"event": true}),
        },
        meta: Some(json!({"client_id": "client-2"})),
        nonce: None,
        signature: None,
        prev_message_hash: None,
        encrypted_metadata: None,
        routing_tag: None,
    };

    let prepared = client
        .prepare_envelope_for_offline_send(envelope)
        .expect("nonce generation should succeed");

    let nonce = prepared.nonce.expect("nonce should be set");
    let re = Regex::new(r"^hmac-[0-9a-f]{32}-\d+$").unwrap();
    assert!(
        re.is_match(&nonce),
        "nonce `{}` did not match expected format",
        nonce
    );
}

#[test]
fn test_prev_message_hash_chains_across_envelopes() {
    let mut client = LtpClient::new("wss://example", "client-3")
        .with_session_mac_key("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
        .with_session_encryption_key(
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        );

    let first = LtpEnvelope {
        r#type: "state_update".to_string(),
        thread_id: "t1".to_string(),
        session_id: Some("s1".to_string()),
        timestamp: 1,
        content_encoding: ContentEncoding::Json,
        payload: Payload {
            kind: "k1".to_string(),
            data: json!({"index": 1}),
        },
        meta: Some(json!({"client_id": "client-3"})),
        nonce: None,
        signature: None,
        prev_message_hash: None,
        encrypted_metadata: None,
        routing_tag: None,
    };

    let prepared_first = client
        .prepare_envelope_for_offline_send(first)
        .expect("first envelope should prepare");
    let first_hash = crypto::hash_envelope(&serde_json::to_value(&prepared_first).unwrap())
        .expect("hashing first envelope");

    let second = LtpEnvelope {
        r#type: "state_update".to_string(),
        thread_id: "t1".to_string(),
        session_id: Some("s1".to_string()),
        timestamp: 2,
        content_encoding: ContentEncoding::Json,
        payload: Payload {
            kind: "k2".to_string(),
            data: json!({"index": 2}),
        },
        meta: Some(json!({"client_id": "client-3"})),
        nonce: None,
        signature: None,
        prev_message_hash: None,
        encrypted_metadata: None,
        routing_tag: None,
    };

    let prepared_second = client
        .prepare_envelope_for_offline_send(second)
        .expect("second envelope should prepare");
    assert_eq!(
        prepared_second.prev_message_hash.as_deref(),
        Some(first_hash.as_str())
    );

    let second_hash = crypto::hash_envelope(&serde_json::to_value(&prepared_second).unwrap())
        .expect("hashing second envelope");

    let third = LtpEnvelope {
        r#type: "state_update".to_string(),
        thread_id: "t1".to_string(),
        session_id: Some("s1".to_string()),
        timestamp: 3,
        content_encoding: ContentEncoding::Json,
        payload: Payload {
            kind: "k3".to_string(),
            data: json!({"index": 3}),
        },
        meta: Some(json!({"client_id": "client-3"})),
        nonce: None,
        signature: None,
        prev_message_hash: None,
        encrypted_metadata: None,
        routing_tag: None,
    };

    let prepared_third = client
        .prepare_envelope_for_offline_send(third)
        .expect("third envelope should prepare");

    assert_eq!(
        prepared_third.prev_message_hash.as_deref(),
        Some(second_hash.as_str())
    );
}

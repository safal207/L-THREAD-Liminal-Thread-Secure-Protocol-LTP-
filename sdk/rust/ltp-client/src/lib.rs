pub mod client;
pub mod crypto;
pub mod error;
pub mod types;

pub use client::LtpClient;
pub use crypto::*;
pub use error::{LtpError, Result};
pub use types::*;

/// SDK version
pub const VERSION: &str = "0.6.0-alpha.3";

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_content_encoding_serialization() {
        let json_str = r#"{"type":"state_update","content_encoding":"json"}"#;
        let value: serde_json::Value = serde_json::from_str(json_str).unwrap();
        assert_eq!(value["content_encoding"], "json");
    }

    #[test]
    fn test_envelope_building() {
        let envelope = LtpEnvelope {
            r#type: "state_update".to_string(),
            thread_id: "test-thread".to_string(),
            session_id: Some("test-session".to_string()),
            timestamp: 1234567890,
            content_encoding: ContentEncoding::Json,
            payload: Payload {
                kind: "test".to_string(),
                data: json!({"key": "value"}),
            },
            meta: Some(json!({"client_id": "test"})),
            nonce: Some("test-nonce".to_string()),
            signature: Some("test-sig".to_string()),
            prev_message_hash: None,
            encrypted_metadata: None,
            routing_tag: None,
        };

        assert_eq!(envelope.r#type, "state_update");
        assert_eq!(envelope.thread_id, "test-thread");
    }

    #[test]
    fn test_handshake_init_serialization() {
        let init = HandshakeInit {
            r#type: "handshake_init".to_string(),
            ltp_version: "0.6".to_string(),
            client_id: "test-client".to_string(),
            device_fingerprint: Some("test-device".to_string()),
            intent: Some("resonant_link".to_string()),
            capabilities: Some(vec!["state-update".to_string()]),
            metadata: Some(json!({"test": true})),
            client_public_key: None,
            client_ecdh_public_key: None,
            client_ecdh_signature: None,
            client_ecdh_timestamp: None,
            key_agreement: None,
        };

        let json = serde_json::to_string(&init).unwrap();
        assert!(json.contains("handshake_init"));
        assert!(json.contains("test-client"));
    }
}

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContentEncoding {
    Json,
    Toon,
}

impl Default for ContentEncoding {
    fn default() -> Self {
        ContentEncoding::Json
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LtpEnvelope<T = serde_json::Value> {
    #[serde(rename = "type")]
    pub r#type: String,
    pub thread_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    pub timestamp: i64,
    #[serde(default)]
    pub content_encoding: ContentEncoding,
    pub payload: Payload<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nonce: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prev_message_hash: Option<String>,  // v0.5+ hash chaining
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encrypted_metadata: Option<String>,  // v0.6+ metadata encryption
    #[serde(skip_serializing_if = "Option::is_none")]
    pub routing_tag: Option<String>,  // v0.6+ routing tag for encrypted metadata
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Payload<T> {
    pub kind: String,
    pub data: T,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HandshakeInit {
    #[serde(rename = "type")]
    pub r#type: String,
    pub ltp_version: String,
    pub client_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_fingerprint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub intent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capabilities: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_public_key: Option<String>,  // Legacy field name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_ecdh_public_key: Option<String>,  // v0.6+ explicit name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_ecdh_signature: Option<String>,  // v0.6+ authenticated ECDH
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_ecdh_timestamp: Option<i64>,  // v0.6+ authenticated ECDH
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_agreement: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HandshakeResume {
    #[serde(rename = "type")]
    pub r#type: String,
    pub ltp_version: String,
    pub client_id: String,
    pub thread_id: String,
    pub resume_reason: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HandshakeAck {
    #[serde(rename = "type")]
    pub r#type: String,
    pub ltp_version: String,
    pub thread_id: String,
    pub session_id: String,
    #[serde(default)]
    pub resumed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_capabilities: Option<Vec<String>>,
    pub heartbeat_interval_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_public_key: Option<String>,  // Legacy field name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_ecdh_public_key: Option<String>,  // v0.6+ explicit name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_ecdh_signature: Option<String>,  // v0.6+ authenticated ECDH
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_ecdh_timestamp: Option<i64>,  // v0.6+ authenticated ECDH
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_agreement: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HandshakeReject {
    #[serde(rename = "type")]
    pub r#type: String,
    pub ltp_version: String,
    pub reason: String,
    #[serde(default)]
    pub suggest_new: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PingMessage {
    #[serde(rename = "type")]
    pub r#type: String,
    pub thread_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    pub timestamp: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PongMessage {
    #[serde(rename = "type")]
    pub r#type: String,
    pub thread_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    pub timestamp: i64,
}

fn current_unix_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

pub fn get_current_timestamp() -> i64 {
    current_unix_timestamp()
}


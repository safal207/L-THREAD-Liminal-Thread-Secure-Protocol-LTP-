use crate::crypto;
use crate::error::{LtpError, Result};
use crate::types::*;
use futures_util::{SinkExt, StreamExt};
use rand::Rng;
use serde::Serialize;
use std::time::Instant;
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream};

type WsStream = WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>;

pub struct LtpClient {
    url: String,
    client_id: String,
    device_fingerprint: Option<String>,
    intent: Option<String>,
    capabilities: Option<Vec<String>>,
    metadata: Option<serde_json::Value>,
    default_context_tag: Option<String>,
    thread_id: Option<String>,
    session_id: Option<String>,
    heartbeat_interval_ms: u64,
    heartbeat_timeout_ms: u64,
    is_connected: bool,
    last_pong_time: Option<Instant>,
    write: Option<futures_util::stream::SplitSink<WsStream, Message>>,
    // v0.6.0 Security features
    enable_ecdh_key_exchange: bool,
    enable_metadata_encryption: bool,
    secret_key: Option<String>,
    session_mac_key: Option<String>,
    ecdh_private_key: Option<String>,
    ecdh_public_key: Option<String>,
    session_encryption_key: Option<String>,
    last_sent_hash: Option<String>,
    last_received_hash: Option<String>,
    seen_nonces: std::collections::HashSet<String>,
}

impl LtpClient {
    /// Create a new LTP client instance
    pub fn new(url: impl Into<String>, client_id: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            client_id: client_id.into(),
            device_fingerprint: None,
            intent: Some("resonant_link".to_string()),
            capabilities: Some(vec![
                "state-update".to_string(),
                "events".to_string(),
                "ping-pong".to_string(),
            ]),
            metadata: None,
            default_context_tag: None,
            thread_id: None,
            session_id: None,
            heartbeat_interval_ms: 15_000,
            heartbeat_timeout_ms: 45_000,
            is_connected: false,
            last_pong_time: None,
            write: None,
            // v0.6.0 Security features initialization
            enable_ecdh_key_exchange: false,
            enable_metadata_encryption: false,
            secret_key: None,
            session_mac_key: None,
            ecdh_private_key: None,
            ecdh_public_key: None,
            session_encryption_key: None,
            last_sent_hash: None,
            last_received_hash: None,
            seen_nonces: std::collections::HashSet::new(),
        }
    }

    /// Enable ECDH key exchange (v0.6+)
    pub fn with_ecdh_key_exchange(mut self, enable: bool) -> Self {
        self.enable_ecdh_key_exchange = enable;
        self
    }

    /// Enable metadata encryption (v0.6+)
    pub fn with_metadata_encryption(mut self, enable: bool) -> Self {
        self.enable_metadata_encryption = enable;
        self
    }

    /// Set secret key for authenticated ECDH and signing (v0.6+)
    pub fn with_secret_key(mut self, secret_key: impl Into<String>) -> Self {
        self.secret_key = Some(secret_key.into());
        self
    }

    /// Set session MAC key (v0.6+)
    pub fn with_session_mac_key(mut self, mac_key: impl Into<String>) -> Self {
        self.session_mac_key = Some(mac_key.into());
        self
    }

    /// Set device fingerprint
    pub fn with_device_fingerprint(mut self, fingerprint: impl Into<String>) -> Self {
        self.device_fingerprint = Some(fingerprint.into());
        self
    }

    /// Set intent
    pub fn with_intent(mut self, intent: impl Into<String>) -> Self {
        self.intent = Some(intent.into());
        self
    }

    /// Set default context tag
    pub fn with_default_context_tag(mut self, tag: impl Into<String>) -> Self {
        self.default_context_tag = Some(tag.into());
        self
    }

    /// Set heartbeat interval
    pub fn with_heartbeat_interval(mut self, interval_ms: u64) -> Self {
        self.heartbeat_interval_ms = interval_ms;
        self
    }

    /// Set heartbeat timeout
    pub fn with_heartbeat_timeout(mut self, timeout_ms: u64) -> Self {
        self.heartbeat_timeout_ms = timeout_ms;
        self
    }

    /// Connect to the LTP server
    pub async fn connect(&mut self) -> Result<()> {
        let url = url::Url::parse(&self.url)
            .map_err(|e| LtpError::InvalidState(format!("Invalid URL: {}", e)))?;

        let (ws_stream, _) = connect_async(url).await?;
        let (write, mut read) = ws_stream.split();
        self.write = Some(write);

        // Send handshake
        if self.thread_id.is_some() {
            self.send_handshake_resume().await?;
        } else {
            self.send_handshake_init().await?;
        }

        // Wait for handshake_ack
        let ack = self.wait_for_handshake_ack(&mut read).await?;
        self.thread_id = Some(ack.thread_id.clone());
        self.session_id = Some(ack.session_id.clone());
        self.is_connected = true;
        self.last_pong_time = Some(Instant::now());

        // Update heartbeat interval if provided by server
        if ack.heartbeat_interval_ms > 0 {
            self.heartbeat_interval_ms = ack.heartbeat_interval_ms;
        }

        // Handle ECDH key exchange (v0.6+)
        if self.enable_ecdh_key_exchange {
            self.handle_ecdh_key_exchange(&ack)?;
        }

        // Start message handling loop (simplified - in production would be more robust)
        // Note: In a real implementation, this would need to share state with the client
        // For now, this is a simplified version
        tokio::spawn(async move {
            while let Some(msg) = read.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        // Handle incoming messages
                        // TODO: Parse and process LTP messages with security features
                        eprintln!("Received: {}", text);
                    }
                    Ok(Message::Close(_)) => {
                        break;
                    }
                    Err(e) => {
                        eprintln!("WebSocket error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
        });

        Ok(())
    }

    /// Send a state update
    pub async fn send_state_update<T: Serialize>(
        &mut self,
        kind: &str,
        data: T,
    ) -> Result<()> {
        if !self.is_connected {
            return Err(LtpError::NotConnected);
        }

        let envelope = self.build_state_update_envelope(kind, data)?;
        self.send_envelope(envelope).await
    }

    /// Send an event
    pub async fn send_event<T: Serialize>(&mut self, event_type: &str, data: T) -> Result<()> {
        if !self.is_connected {
            return Err(LtpError::NotConnected);
        }

        let envelope = self.build_event_envelope(event_type, data)?;
        self.send_envelope(envelope).await
    }

    /// Get current thread ID
    pub fn thread_id(&self) -> Option<&String> {
        self.thread_id.as_ref()
    }

    /// Get current session ID
    pub fn session_id(&self) -> Option<&String> {
        self.session_id.as_ref()
    }

    // Private helpers

    async fn send_handshake_init(&mut self) -> Result<()> {
        // Generate ECDH key pair if enabled
        let (ecdh_public_key, ecdh_private_key) = if self.enable_ecdh_key_exchange {
            let (pub_key, priv_key) = crypto::generate_ecdh_key_pair();
            self.ecdh_public_key = Some(pub_key.clone());
            self.ecdh_private_key = Some(priv_key.clone());
            (Some(pub_key), Some(priv_key))
        } else {
            (None, None)
        };

        let mut init = HandshakeInit {
            r#type: "handshake_init".to_string(),
            ltp_version: "0.6".to_string(),
            client_id: self.client_id.clone(),
            device_fingerprint: self.device_fingerprint.clone(),
            intent: self.intent.clone(),
            capabilities: self.capabilities.clone(),
            metadata: self.metadata.clone(),
            client_public_key: None,
            client_ecdh_public_key: None,
            client_ecdh_signature: None,
            client_ecdh_timestamp: None,
            key_agreement: None,
        };

        // Add ECDH public key if available
        if let Some(ref pub_key) = ecdh_public_key {
            init.client_ecdh_public_key = Some(pub_key.clone());
            init.client_public_key = Some(pub_key.clone()); // Legacy field
            init.key_agreement = Some(serde_json::json!({
                "algorithm": "secp256r1",
                "method": "ecdh",
                "hkdf": "sha256"
            }));

            // Sign ECDH public key if secret_key is available (v0.6+ authenticated ECDH)
            if let Some(ref secret_key) = self.secret_key {
                let timestamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as i64;
                
                let signature = crypto::sign_ecdh_public_key(
                    pub_key,
                    &self.client_id,
                    timestamp,
                    secret_key,
                );
                
                init.client_ecdh_signature = Some(signature);
                init.client_ecdh_timestamp = Some(timestamp);
            }
        }

        let json = serde_json::to_string(&init)?;
        self.send_text(json).await
    }

    async fn send_handshake_resume(&mut self) -> Result<()> {
        let resume = HandshakeResume {
            r#type: "handshake_resume".to_string(),
            ltp_version: "0.6".to_string(),
            client_id: self.client_id.clone(),
            thread_id: self.thread_id.clone().unwrap(),
            resume_reason: "automatic_reconnect".to_string(),
        };

        let json = serde_json::to_string(&resume)?;
        self.send_text(json).await
    }

    async fn wait_for_handshake_ack(
        &mut self,
        read: &mut futures_util::stream::SplitStream<WsStream>,
    ) -> Result<HandshakeAck> {
        loop {
            if let Some(Ok(Message::Text(text))) = read.next().await {
                if let Ok(ack) = serde_json::from_str::<HandshakeAck>(&text) {
                    return Ok(ack);
                }
                if let Ok(reject) = serde_json::from_str::<HandshakeReject>(&text) {
                    if self.thread_id.is_some() {
                        // Resume was rejected, try init
                        self.thread_id = None;
                        return Err(LtpError::Handshake(format!(
                            "Resume rejected: {}",
                            reject.reason
                        )));
                    } else {
                        return Err(LtpError::Handshake(reject.reason));
                    }
                }
            }
        }
    }

    /// Handle ECDH key exchange and derive session keys (v0.6+)
    fn handle_ecdh_key_exchange(&mut self, ack: &HandshakeAck) -> Result<()> {
        // Get server's ECDH public key
        let server_ecdh_public_key = ack
            .server_ecdh_public_key
            .as_ref()
            .or_else(|| ack.server_public_key.as_ref())
            .ok_or_else(|| LtpError::InvalidState("Server did not provide ECDH public key".to_string()))?;

        // Verify server's ECDH public key signature if available (v0.6+ authenticated ECDH)
        if let (Some(ref signature), Some(timestamp)) = (
            ack.server_ecdh_signature.as_ref(),
            ack.server_ecdh_timestamp,
        ) {
            if let Some(ref secret_key) = self.secret_key {
                // For server verification, we'd need server_id - simplified for now
                // In production, this should verify against server's known identity
                crypto::verify_ecdh_public_key(
                    server_ecdh_public_key,
                    "server", // TODO: Use actual server_id from ack
                    timestamp,
                    signature,
                    secret_key,
                    300_000, // 5 minutes max age
                )
                .map_err(|e| LtpError::InvalidState(format!("ECDH signature verification failed: {}", e)))?;
            }
        }

        // Derive shared secret
        let private_key = self
            .ecdh_private_key
            .as_ref()
            .ok_or_else(|| LtpError::InvalidState("Client ECDH private key not found".to_string()))?;

        let shared_secret = crypto::derive_shared_secret(private_key, server_ecdh_public_key)
            .map_err(|e| LtpError::InvalidState(format!("Failed to derive shared secret: {}", e)))?;

        // Derive session keys using HKDF
        let session_id = self
            .session_id
            .as_ref()
            .ok_or_else(|| LtpError::InvalidState("Session ID not available".to_string()))?;

        let (encryption_key, mac_key, _iv_key) = crypto::derive_session_keys(&shared_secret, session_id)
            .map_err(|e| LtpError::InvalidState(format!("Failed to derive session keys: {}", e)))?;

        // Store session keys
        self.session_encryption_key = Some(encryption_key);
        self.session_mac_key = Some(mac_key);

        Ok(())
    }

    async fn send_text(&mut self, text: String) -> Result<()> {
        if let Some(ref mut write) = self.write {
            write.send(Message::Text(text)).await?;
            Ok(())
        } else {
            Err(LtpError::NotConnected)
        }
    }

    async fn send_envelope(&mut self, mut envelope: LtpEnvelope) -> Result<()> {
        // Generate nonce (HMAC-based if MAC key available, v0.6+)
        let nonce = self.generate_nonce()?;
        envelope.nonce = Some(nonce.clone());

        // Add prev_message_hash for hash chaining (v0.5+)
        envelope.prev_message_hash = self.last_sent_hash.clone();

        // Generate signature
        if let Some(ref secret_key) = self.secret_key {
            let signature = crypto::sign_message(&serde_json::to_value(&envelope)?, secret_key)?;
            envelope.signature = Some(signature);
        }

        // Encrypt metadata if enabled (v0.6+)
        if self.enable_metadata_encryption {
            if let (Some(ref encryption_key), Some(ref mac_key)) = (
                self.session_encryption_key.as_ref(),
                self.session_mac_key.as_ref(),
            ) {
                // Prepare metadata for encryption
                let metadata = serde_json::json!({
                    "thread_id": envelope.thread_id,
                    "session_id": envelope.session_id.as_ref().unwrap_or(&"".to_string()),
                    "timestamp": envelope.timestamp,
                });

                // Encrypt metadata
                let encrypted_metadata = crypto::encrypt_metadata(&metadata, encryption_key)?;
                envelope.encrypted_metadata = Some(encrypted_metadata);

                // Generate routing tag
                let routing_tag = crypto::generate_routing_tag(
                    &envelope.thread_id,
                    envelope.session_id.as_ref().unwrap_or(&"".to_string()),
                    mac_key,
                )?;
                envelope.routing_tag = Some(routing_tag);

                // Clear plaintext metadata (server uses routing_tag)
                envelope.thread_id = "".to_string();
                envelope.session_id = None;
                envelope.timestamp = 0;
            }
        }

        // Calculate hash for next message (hash chaining)
        let envelope_value = serde_json::to_value(&envelope)?;
        let message_hash = crypto::hash_envelope(&envelope_value)?;
        self.last_sent_hash = Some(message_hash);

        let json = serde_json::to_string(&envelope)?;
        self.send_text(json).await
    }

    /// Generate nonce (HMAC-based if MAC key available, v0.6+)
    fn generate_nonce(&self) -> Result<String, LtpError> {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;

        // Try HMAC-based nonce if MAC key available (v0.6+)
        if let Some(ref mac_key) = self.session_mac_key {
            let mut rng = rand::thread_rng();
            let random_bytes: [u8; 16] = rng.gen();
            let random_hex = hex::encode(random_bytes);
            
            let input = format!("{}-{}", timestamp, random_hex);
            let hmac = crypto::hmac_sha256(&input, mac_key);
            
            // Format: hmac-{first 32 chars of HMAC}-{timestamp}
            let hmac_prefix = if hmac.len() >= 32 {
                &hmac[..32]
            } else {
                &hmac[..]
            };
            return Ok(format!("hmac-{}-{}", hmac_prefix, timestamp));
        }

        // Fallback to legacy format (backward compatibility)
        Ok(uuid::Uuid::new_v4().to_string())
    }

    /// Decrypt metadata if encrypted (v0.6+)
    fn decrypt_metadata_if_needed(&self, envelope: &mut LtpEnvelope) -> Result<(), LtpError> {
        if let Some(ref encrypted_metadata) = envelope.encrypted_metadata {
            if let Some(ref encryption_key) = self.session_encryption_key {
                let metadata = crypto::decrypt_metadata(encrypted_metadata, encryption_key)
                    .map_err(|e| LtpError::InvalidState(format!("Failed to decrypt metadata: {}", e)))?;
                
                // Restore plaintext metadata
                envelope.thread_id = metadata
                    .get("thread_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                envelope.session_id = metadata
                    .get("session_id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                envelope.timestamp = metadata
                    .get("timestamp")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
            }
        }
        Ok(())
    }

    /// Verify hash chaining (v0.5+)
    fn verify_hash_chain(&self, envelope: &LtpEnvelope) -> Result<(), LtpError> {
        if let Some(ref prev_hash) = envelope.prev_message_hash {
            if let Some(ref last_received) = self.last_received_hash {
                if prev_hash != last_received {
                    return Err(LtpError::InvalidState(
                        "Hash chain verification failed - message out of order or tampered".to_string()
                    ));
                }
            }
        }

        // Update last received hash
        let envelope_value = serde_json::to_value(envelope)
            .map_err(|e| LtpError::InvalidState(format!("Failed to serialize envelope: {}", e)))?;
        let message_hash = crypto::hash_envelope(&envelope_value)
            .map_err(|e| LtpError::InvalidState(format!("Failed to hash envelope: {}", e)))?;
        
        // Note: This would need mutable reference, but for now we'll skip updating
        // In a real implementation, this would update self.last_received_hash
        
        Ok(())
    }

    fn build_state_update_envelope<T: Serialize>(
        &self,
        kind: &str,
        data: T,
    ) -> Result<LtpEnvelope> {
        let payload_data = serde_json::to_value(data)?;

        let mut meta = serde_json::json!({
            "client_id": self.client_id
        });

        if let Some(ref tag) = self.default_context_tag {
            meta["context_tag"] = serde_json::Value::String(tag.clone());
        }

        Ok(LtpEnvelope {
            r#type: "state_update".to_string(),
            thread_id: self.thread_id.clone().unwrap_or_default(),
            session_id: self.session_id.clone(),
            timestamp: get_current_timestamp(),
            content_encoding: ContentEncoding::Json,
            payload: Payload {
                kind: kind.to_string(),
                data: payload_data,
            },
            meta: Some(meta),
            nonce: None, // Will be set in send_envelope
            signature: None, // Will be set in send_envelope
            prev_message_hash: None, // Will be set in send_envelope
            encrypted_metadata: None, // Will be set in send_envelope if enabled
            routing_tag: None, // Will be set in send_envelope if enabled
        })
    }

    fn build_event_envelope<T: Serialize>(&self, event_type: &str, data: T) -> Result<LtpEnvelope> {
        let payload_data = serde_json::to_value(data)?;

        let mut meta = serde_json::json!({
            "client_id": self.client_id
        });

        if let Some(ref tag) = self.default_context_tag {
            meta["context_tag"] = serde_json::Value::String(tag.clone());
        }

        Ok(LtpEnvelope {
            r#type: "event".to_string(),
            thread_id: self.thread_id.clone().unwrap_or_default(),
            session_id: self.session_id.clone(),
            timestamp: get_current_timestamp(),
            content_encoding: ContentEncoding::Json,
            payload: Payload {
                kind: event_type.to_string(),
                data: payload_data,
            },
            meta: Some(meta),
            nonce: None, // Will be set in send_envelope
            signature: None, // Will be set in send_envelope
            prev_message_hash: None, // Will be set in send_envelope
            encrypted_metadata: None, // Will be set in send_envelope if enabled
            routing_tag: None, // Will be set in send_envelope if enabled
        })
    }
}

use crate::crypto;
use crate::error::{LtpError, Result};
use crate::types::*;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex;
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream};

type WsStream = WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>;

const MAX_MESSAGE_AGE_MS: i64 = 60_000;
const MAX_FUTURE_SKEW_MS: i64 = 5_000;
const MAX_SEEN_NONCES: usize = 4_096;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReceiveSecuritySnapshot {
    pub version: u8,
    pub thread_id: String,
    pub session_id: String,
    pub last_received_hash: Option<String>,
    pub seen_nonces: Vec<String>,
}

#[derive(Debug, Default)]
struct ReceiveSecurityState {
    session_id: Option<String>,
    last_received_hash: Option<String>,
    seen_nonces: HashSet<String>,
    generation: u64,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn normalize_timestamp_ms(timestamp: i64) -> i64 {
    if timestamp < 1_000_000_000_000 {
        timestamp.saturating_mul(1_000)
    } else {
        timestamp
    }
}

fn validate_timestamp(message: &Value) -> Result<()> {
    let raw_timestamp = message
        .get("timestamp")
        .and_then(Value::as_i64)
        .ok_or_else(|| LtpError::InvalidState("Missing or invalid timestamp".to_string()))?;
    let timestamp_ms = normalize_timestamp_ms(raw_timestamp);
    let age_ms = now_ms().saturating_sub(timestamp_ms);

    if age_ms > MAX_MESSAGE_AGE_MS {
        return Err(LtpError::InvalidState(format!(
            "Message is too old ({}ms)",
            age_ms
        )));
    }
    if age_ms < -MAX_FUTURE_SKEW_MS {
        return Err(LtpError::InvalidState(format!(
            "Message timestamp is too far in the future ({}ms)",
            -age_ms
        )));
    }

    Ok(())
}

fn validate_nonce(message: &Value, seen_nonces: &mut HashSet<String>) -> Result<()> {
    let nonce = message
        .get("nonce")
        .and_then(Value::as_str)
        .filter(|nonce| !nonce.is_empty())
        .ok_or_else(|| LtpError::InvalidState("Missing or invalid nonce".to_string()))?;

    if seen_nonces.contains(nonce) {
        return Err(LtpError::InvalidState(
            "Replay detected: nonce has already been accepted".to_string(),
        ));
    }

    if let Some(rest) = nonce.strip_prefix("hmac-") {
        let (mac_prefix, timestamp_text) = rest
            .rsplit_once('-')
            .ok_or_else(|| LtpError::InvalidState("Invalid HMAC nonce format".to_string()))?;
        if mac_prefix.len() != 32 || !mac_prefix.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(LtpError::InvalidState(
                "Invalid HMAC nonce authentication prefix".to_string(),
            ));
        }
        let nonce_timestamp = timestamp_text
            .parse::<i64>()
            .map_err(|_| LtpError::InvalidState("Invalid HMAC nonce timestamp".to_string()))?;
        let nonce_age_ms = now_ms().saturating_sub(normalize_timestamp_ms(nonce_timestamp));
        if nonce_age_ms > MAX_MESSAGE_AGE_MS || nonce_age_ms < -MAX_FUTURE_SKEW_MS {
            return Err(LtpError::InvalidState(
                "HMAC nonce timestamp is outside the accepted window".to_string(),
            ));
        }
    }

    if seen_nonces.len() >= MAX_SEEN_NONCES {
        return Err(LtpError::InvalidState(
            "Replay cache capacity reached; refusing to evict live security state".to_string(),
        ));
    }

    seen_nonces.insert(nonce.to_string());
    Ok(())
}

fn decrypt_incoming_metadata(message: &mut Value, encryption_key: Option<&str>) -> Result<()> {
    let encrypted_metadata = match message.get("encrypted_metadata").and_then(Value::as_str) {
        Some(value) => value,
        None => return Ok(()),
    };
    let encryption_key = encryption_key.ok_or_else(|| {
        LtpError::InvalidState(
            "Encrypted metadata received without a negotiated encryption key".to_string(),
        )
    })?;
    let metadata =
        crypto::decrypt_metadata(encrypted_metadata, encryption_key).map_err(|error| {
            LtpError::InvalidState(format!("Metadata decryption failed: {}", error))
        })?;
    let object = message.as_object_mut().ok_or_else(|| {
        LtpError::InvalidState("Inbound LTP frame is not a JSON object".to_string())
    })?;
    object.insert(
        "thread_id".to_string(),
        metadata
            .get("thread_id")
            .cloned()
            .unwrap_or(Value::String(String::new())),
    );
    object.insert(
        "session_id".to_string(),
        metadata
            .get("session_id")
            .cloned()
            .unwrap_or(Value::String(String::new())),
    );
    object.insert(
        "timestamp".to_string(),
        metadata.get("timestamp").cloned().unwrap_or(Value::from(0)),
    );
    Ok(())
}

fn verify_hash_chain(message: &Value, last_received_hash: Option<&str>) -> Result<String> {
    if let Some(last_received_hash) = last_received_hash {
        let previous_hash = message
            .get("prev_message_hash")
            .and_then(Value::as_str)
            .filter(|hash| !hash.is_empty())
            .ok_or_else(|| {
                LtpError::InvalidState(
                    "Missing previous hash for an active receive chain".to_string(),
                )
            })?;
        if previous_hash != last_received_hash {
            return Err(LtpError::InvalidState(
                "Hash chain verification failed - message out of order or tampered".to_string(),
            ));
        }
    }

    crypto::hash_envelope(message)
        .map_err(|error| LtpError::InvalidState(format!("Failed to hash envelope: {}", error)))
}

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
    receive_security: Arc<Mutex<ReceiveSecurityState>>,
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
            enable_ecdh_key_exchange: false,
            enable_metadata_encryption: false,
            secret_key: None,
            session_mac_key: None,
            ecdh_private_key: None,
            ecdh_public_key: None,
            session_encryption_key: None,
            last_sent_hash: None,
            receive_security: Arc::new(Mutex::new(ReceiveSecurityState::default())),
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

    /// Set session encryption key directly (v0.6+)
    pub fn with_session_encryption_key(mut self, encryption_key: impl Into<String>) -> Self {
        self.session_encryption_key = Some(encryption_key.into());
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

        if self.thread_id.is_some() {
            self.send_handshake_resume().await?;
        } else {
            self.send_handshake_init().await?;
        }

        let previous_session_id = self.session_id.clone();
        let ack = self.wait_for_handshake_ack(&mut read).await?;
        let receive_generation = self
            .prepare_receive_security_for_ack(previous_session_id.as_deref(), &ack)
            .await?;
        self.thread_id = Some(ack.thread_id.clone());
        self.session_id = Some(ack.session_id.clone());
        self.is_connected = true;
        self.last_pong_time = Some(Instant::now());

        if ack.heartbeat_interval_ms > 0 {
            self.heartbeat_interval_ms = ack.heartbeat_interval_ms;
        }

        if self.enable_ecdh_key_exchange {
            self.handle_ecdh_key_exchange(&ack)?;
        }

        let receive_mac_key = self.session_mac_key.clone();
        let receive_encryption_key = self.session_encryption_key.clone();
        let receive_security = Arc::clone(&self.receive_security);

        tokio::spawn(async move {
            while let Some(msg) = read.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        let mut message: Value = match serde_json::from_str(&text) {
                            Ok(value) => value,
                            Err(error) => {
                                eprintln!("Dropping malformed LTP frame: {}", error);
                                continue;
                            }
                        };
                        let wire_message = message.clone();

                        if let Err(error) = decrypt_incoming_metadata(
                            &mut message,
                            receive_encryption_key.as_deref(),
                        ) {
                            eprintln!("Dropping LTP frame: {}", error);
                            continue;
                        }

                        let mac_key = match receive_mac_key.as_deref() {
                            Some(key) => key,
                            None => {
                                eprintln!("Dropping LTP frame: no negotiated session MAC key");
                                continue;
                            }
                        };
                        match crypto::verify_signature(&message, mac_key) {
                            Ok(true) => {}
                            Ok(false) => {
                                eprintln!("Dropping LTP frame: signature verification failed");
                                continue;
                            }
                            Err(error) => {
                                eprintln!(
                                    "Dropping LTP frame: signature verification error: {}",
                                    error
                                );
                                continue;
                            }
                        }
                        if let Err(error) = validate_timestamp(&message) {
                            eprintln!("Dropping LTP frame: {}", error);
                            continue;
                        }

                        let (expected_hash, mut candidate_nonces) = {
                            let security = receive_security.lock().await;
                            if security.generation != receive_generation {
                                break;
                            }
                            (
                                security.last_received_hash.clone(),
                                security.seen_nonces.clone(),
                            )
                        };
                        let candidate_hash =
                            match verify_hash_chain(&wire_message, expected_hash.as_deref()) {
                                Ok(hash) => hash,
                                Err(error) => {
                                    eprintln!("Dropping LTP frame: {}", error);
                                    continue;
                                }
                            };
                        if let Err(error) = validate_nonce(&message, &mut candidate_nonces) {
                            eprintln!("Dropping LTP frame: {}", error);
                            continue;
                        }

                        let mut security = receive_security.lock().await;
                        if security.generation != receive_generation {
                            break;
                        }
                        if security.last_received_hash.as_deref() != expected_hash.as_deref() {
                            eprintln!(
                                "Dropping LTP frame: concurrent receive-state commit detected"
                            );
                            continue;
                        }
                        security.last_received_hash = Some(candidate_hash);
                        security.seen_nonces = candidate_nonces;
                        eprintln!("Received authenticated LTP frame: {}", message);
                    }
                    Ok(Message::Close(_)) => break,
                    Err(error) => {
                        eprintln!("WebSocket error: {}", error);
                        break;
                    }
                    _ => {}
                }
            }
        });

        Ok(())
    }

    /// Send a state update
    pub async fn send_state_update<T: Serialize>(&mut self, kind: &str, data: T) -> Result<()> {
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

    /// Send an authenticated heartbeat ping.
    pub async fn send_ping(&mut self) -> Result<()> {
        if !self.is_connected {
            return Err(LtpError::NotConnected);
        }
        let envelope = self.build_control_envelope("ping")?;
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

    /// Prepare an envelope with all security features applied without sending it over the network.
    pub fn prepare_envelope_for_offline_send(
        &mut self,
        envelope: LtpEnvelope,
    ) -> Result<LtpEnvelope> {
        self.finalize_envelope(envelope)
    }

    pub async fn export_receive_security_snapshot(&self) -> Result<ReceiveSecuritySnapshot> {
        let thread_id = self.thread_id.clone().ok_or_else(|| {
            LtpError::InvalidState("Cannot snapshot receive state without thread ID".to_string())
        })?;
        let session_id = self.session_id.clone().ok_or_else(|| {
            LtpError::InvalidState("Cannot snapshot receive state without session ID".to_string())
        })?;
        let security = self.receive_security.lock().await;
        let mut seen_nonces: Vec<String> = security.seen_nonces.iter().cloned().collect();
        seen_nonces.sort();
        Ok(ReceiveSecuritySnapshot {
            version: 1,
            thread_id,
            session_id,
            last_received_hash: security.last_received_hash.clone(),
            seen_nonces,
        })
    }

    pub async fn restore_receive_security_snapshot(
        &mut self,
        snapshot: ReceiveSecuritySnapshot,
    ) -> Result<()> {
        if snapshot.version != 1 {
            return Err(LtpError::InvalidState(
                "Unsupported receive snapshot version".to_string(),
            ));
        }
        self.thread_id = Some(snapshot.thread_id.clone());
        self.session_id = Some(snapshot.session_id.clone());
        let mut security = self.receive_security.lock().await;
        security.session_id = Some(snapshot.session_id);
        security.last_received_hash = snapshot.last_received_hash;
        security.seen_nonces = snapshot.seen_nonces.into_iter().collect();
        Ok(())
    }

    async fn prepare_receive_security_for_ack(
        &self,
        previous_session_id: Option<&str>,
        ack: &HandshakeAck,
    ) -> Result<u64> {
        let resumed_same_session =
            ack.resumed && previous_session_id == Some(ack.session_id.as_str());
        let mut security = self.receive_security.lock().await;
        security.generation = security.generation.wrapping_add(1);
        if resumed_same_session {
            if security.session_id.as_deref() != Some(ack.session_id.as_str()) {
                return Err(LtpError::InvalidState(
                    "Resume acknowledged without matching receive security snapshot".to_string(),
                ));
            }
        } else {
            security.session_id = Some(ack.session_id.clone());
            security.last_received_hash = None;
            security.seen_nonces.clear();
        }
        Ok(security.generation)
    }

    async fn send_handshake_init(&mut self) -> Result<()> {
        let (ecdh_public_key, _ecdh_private_key) = if self.enable_ecdh_key_exchange {
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

        if let Some(ref pub_key) = ecdh_public_key {
            init.client_ecdh_public_key = Some(pub_key.clone());
            init.client_public_key = Some(pub_key.clone());
            init.key_agreement = Some(serde_json::json!({
                "algorithm": "secp256r1",
                "method": "ecdh",
                "hkdf": "sha256"
            }));

            if let Some(ref secret_key) = self.secret_key {
                let timestamp = now_ms();
                let signature =
                    crypto::sign_ecdh_public_key(pub_key, &self.client_id, timestamp, secret_key);
                init.client_ecdh_signature = Some(signature);
                init.client_ecdh_timestamp = Some(timestamp);
            }
        }

        let json = serde_json::to_string(&init)?;
        self.send_text(json).await
    }

    async fn send_handshake_resume(&mut self) -> Result<()> {
        let thread_id = self.thread_id.clone().ok_or_else(|| {
            LtpError::InvalidState("send_handshake_resume called without thread_id".to_string())
        })?;
        let (public_key, private_key) = if self.enable_ecdh_key_exchange {
            let (public_key, private_key) = crypto::generate_ecdh_key_pair();
            self.ecdh_public_key = Some(public_key.clone());
            self.ecdh_private_key = Some(private_key.clone());
            (Some(public_key), Some(private_key))
        } else {
            (None, None)
        };
        let timestamp = public_key.as_ref().map(|_| now_ms());
        let signature = match (&public_key, timestamp, &self.secret_key) {
            (Some(public_key), Some(timestamp), Some(secret_key)) => Some(
                crypto::sign_ecdh_public_key(public_key, &self.client_id, timestamp, secret_key),
            ),
            _ => None,
        };
        let resume = HandshakeResume {
            r#type: "handshake_resume".to_string(),
            ltp_version: "0.6".to_string(),
            client_id: self.client_id.clone(),
            thread_id,
            resume_reason: "automatic_reconnect".to_string(),
            client_public_key: public_key.clone(),
            client_ecdh_public_key: public_key,
            client_ecdh_signature: signature,
            client_ecdh_timestamp: timestamp,
            key_agreement: private_key.map(|_| {
                serde_json::json!({
                    "algorithm": "secp256r1",
                    "method": "ecdh",
                    "hkdf": "sha256"
                })
            }),
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

    fn handle_ecdh_key_exchange(&mut self, ack: &HandshakeAck) -> Result<()> {
        let server_ecdh_public_key = ack
            .server_ecdh_public_key
            .as_ref()
            .or_else(|| ack.server_public_key.as_ref())
            .ok_or_else(|| {
                LtpError::InvalidState("Server did not provide ECDH public key".to_string())
            })?;

        if let Some(ref secret_key) = self.secret_key {
            let signature = ack.server_ecdh_signature.as_ref().ok_or_else(|| {
                LtpError::InvalidState(
                    "Authenticated ECDH requires a server key signature".to_string(),
                )
            })?;
            let timestamp = ack.server_ecdh_timestamp.ok_or_else(|| {
                LtpError::InvalidState(
                    "Authenticated ECDH requires a server key timestamp".to_string(),
                )
            })?;
            let session_id = self.session_id.as_ref().ok_or_else(|| {
                LtpError::InvalidState("Session ID not available for ECDH binding".to_string())
            })?;
            crypto::verify_ecdh_public_key(
                server_ecdh_public_key,
                session_id,
                timestamp,
                signature,
                secret_key,
                300_000,
            )
            .map_err(|e| {
                LtpError::InvalidState(format!("ECDH signature verification failed: {}", e))
            })?;
        }

        let private_key = self.ecdh_private_key.as_ref().ok_or_else(|| {
            LtpError::InvalidState("Client ECDH private key not found".to_string())
        })?;

        let shared_secret = crypto::derive_shared_secret(private_key, server_ecdh_public_key)
            .map_err(|e| {
                LtpError::InvalidState(format!("Failed to derive shared secret: {}", e))
            })?;

        let session_id = self
            .session_id
            .as_ref()
            .ok_or_else(|| LtpError::InvalidState("Session ID not available".to_string()))?;

        let (encryption_key, mac_key, _iv_key) =
            crypto::derive_session_keys(&shared_secret, session_id).map_err(|e| {
                LtpError::InvalidState(format!("Failed to derive session keys: {}", e))
            })?;

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

    async fn send_envelope(&mut self, envelope: LtpEnvelope) -> Result<()> {
        let envelope = self.finalize_envelope(envelope)?;
        let json = serde_json::to_string(&envelope)?;
        self.send_text(json).await
    }

    fn finalize_envelope(&mut self, mut envelope: LtpEnvelope) -> Result<LtpEnvelope> {
        let nonce = self.generate_nonce()?;
        envelope.nonce = Some(nonce);
        envelope.prev_message_hash = self.last_sent_hash.clone();

        let is_control = envelope.r#type == "ping" || envelope.r#type == "pong";
        let signing_key = if is_control {
            self.session_mac_key.as_ref().ok_or_else(|| {
                LtpError::InvalidState(
                    "Post-handshake control frame requires negotiated session MAC key".to_string(),
                )
            })?
        } else {
            self.session_mac_key
                .as_ref()
                .or(self.secret_key.as_ref())
                .ok_or_else(|| LtpError::InvalidState("No signing key configured".to_string()))?
        };
        let signature = crypto::sign_message(&serde_json::to_value(&envelope)?, signing_key)?;
        envelope.signature = Some(signature);

        if self.enable_metadata_encryption {
            if let (Some(ref encryption_key), Some(ref mac_key)) = (
                self.session_encryption_key.as_ref(),
                self.session_mac_key.as_ref(),
            ) {
                let metadata = serde_json::json!({
                    "thread_id": envelope.thread_id,
                    "session_id": envelope.session_id.as_ref().unwrap_or(&"".to_string()),
                    "timestamp": envelope.timestamp,
                });

                let encrypted_metadata = crypto::encrypt_metadata(&metadata, encryption_key)?;
                envelope.encrypted_metadata = Some(encrypted_metadata);

                let routing_tag = crypto::generate_routing_tag(
                    &envelope.thread_id,
                    envelope.session_id.as_ref().unwrap_or(&"".to_string()),
                    mac_key,
                )?;
                envelope.routing_tag = Some(routing_tag);
                envelope.thread_id = "".to_string();
                envelope.session_id = None;
                envelope.timestamp = 0;
            }
        }

        let envelope_value = serde_json::to_value(&envelope)?;
        let message_hash = crypto::hash_envelope(&envelope_value)?;
        self.last_sent_hash = Some(message_hash);

        Ok(envelope)
    }

    fn generate_nonce(&self) -> Result<String> {
        if let Some(ref mac_key) = self.session_mac_key {
            return Ok(crypto::generate_hmac_nonce(mac_key));
        }
        Ok(uuid::Uuid::new_v4().to_string())
    }

    #[allow(dead_code)]
    fn decrypt_metadata_if_needed(&self, envelope: &mut LtpEnvelope) -> Result<()> {
        if let Some(ref encrypted_metadata) = envelope.encrypted_metadata {
            let encryption_key = self.session_encryption_key.as_ref().ok_or_else(|| {
                LtpError::InvalidState(
                    "Encrypted metadata received without a negotiated key".to_string(),
                )
            })?;
            let metadata =
                crypto::decrypt_metadata(encrypted_metadata, encryption_key).map_err(|e| {
                    LtpError::InvalidState(format!("Failed to decrypt metadata: {}", e))
                })?;
            envelope.thread_id = metadata
                .get("thread_id")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            envelope.session_id = metadata
                .get("session_id")
                .and_then(Value::as_str)
                .map(str::to_string);
            envelope.timestamp = metadata
                .get("timestamp")
                .and_then(Value::as_i64)
                .unwrap_or(0);
        }
        Ok(())
    }

    fn build_state_update_envelope<T: Serialize>(
        &self,
        kind: &str,
        data: T,
    ) -> Result<LtpEnvelope> {
        let payload_data = serde_json::to_value(data)?;
        let mut meta = serde_json::json!({"client_id": self.client_id});

        if let Some(ref tag) = self.default_context_tag {
            meta["context_tag"] = Value::String(tag.clone());
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
            nonce: None,
            signature: None,
            prev_message_hash: None,
            encrypted_metadata: None,
            routing_tag: None,
        })
    }

    fn build_control_envelope(&self, control_type: &str) -> Result<LtpEnvelope> {
        Ok(LtpEnvelope {
            r#type: control_type.to_string(),
            thread_id: self.thread_id.clone().unwrap_or_default(),
            session_id: self.session_id.clone(),
            timestamp: get_current_timestamp(),
            content_encoding: ContentEncoding::Json,
            payload: Payload {
                kind: "control".to_string(),
                data: serde_json::json!({}),
            },
            meta: Some(serde_json::json!({"client_id": self.client_id})),
            nonce: None,
            signature: None,
            prev_message_hash: None,
            encrypted_metadata: None,
            routing_tag: None,
        })
    }

    fn build_event_envelope<T: Serialize>(&self, event_type: &str, data: T) -> Result<LtpEnvelope> {
        let payload_data = serde_json::to_value(data)?;
        let mut meta = serde_json::json!({"client_id": self.client_id});

        if let Some(ref tag) = self.default_context_tag {
            meta["context_tag"] = Value::String(tag.clone());
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
            nonce: None,
            signature: None,
            prev_message_hash: None,
            encrypted_metadata: None,
            routing_tag: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn is_hex(s: &str) -> bool {
        !s.is_empty() && s.chars().all(|c| c.is_ascii_hexdigit())
    }

    #[test]
    fn hmac_nonce_contains_mac_prefix_and_timestamp() {
        let client =
            LtpClient::new("ws://example.com", "client-123").with_session_mac_key("test-mac-key");

        let nonce = client.generate_nonce().expect("nonce should be generated");
        let parts: Vec<&str> = nonce.split('-').collect();

        assert_eq!(parts.first(), Some(&"hmac"));
        assert_eq!(
            parts.len(),
            3,
            "nonce `{}` did not have three segments",
            nonce
        );
        assert_eq!(parts[1].len(), 32);
        assert!(is_hex(parts[1]));
        assert!(parts[2].parse::<i64>().expect("timestamp") > 0);
    }

    #[test]
    fn receive_chain_requires_previous_hash_after_first_commit() {
        let first = serde_json::json!({
            "type": "state_update",
            "thread_id": "thread",
            "session_id": "session",
            "timestamp": 1_700_000_000,
            "nonce": "nonce-1",
            "payload": {"kind": "test", "data": {}},
            "meta": {},
            "content_encoding": "json"
        });
        let first_hash = verify_hash_chain(&first, None).expect("first hash");
        let missing_link = verify_hash_chain(&first, Some(&first_hash));
        assert!(missing_link.is_err());
    }

    #[test]
    fn encrypted_receive_chain_commits_wire_envelope() {
        let wire = serde_json::json!({
            "type": "state_update",
            "thread_id": "",
            "session_id": null,
            "timestamp": 0,
            "nonce": "nonce-wire",
            "payload": {"kind": "test", "data": {}},
            "meta": {},
            "content_encoding": "json",
            "prev_message_hash": "",
            "encrypted_metadata": "ciphertext:iv:tag"
        });
        let mut logical = wire.clone();
        logical["thread_id"] = Value::String("thread".to_string());
        logical["session_id"] = Value::String("session".to_string());
        logical["timestamp"] = Value::from(1_700_000_000_000_i64);

        let committed = verify_hash_chain(&wire, None).expect("wire hash");
        assert_eq!(
            committed,
            crypto::hash_envelope(&wire).expect("wire hash direct")
        );
        assert_ne!(
            committed,
            crypto::hash_envelope(&logical).expect("logical hash")
        );
    }

    #[test]
    fn outbound_signing_prefers_negotiated_session_mac_key() {
        let mut client = LtpClient::new("ws://example.com", "client-123")
            .with_secret_key("long-term-secret")
            .with_session_mac_key("session-mac-key");
        client.thread_id = Some("thread".to_string());
        client.session_id = Some("session".to_string());

        let envelope = client
            .build_state_update_envelope("test", serde_json::json!({"value": 1}))
            .expect("envelope");
        let finalized = client
            .prepare_envelope_for_offline_send(envelope)
            .expect("finalized envelope");
        let value = serde_json::to_value(&finalized).expect("value");

        assert!(crypto::verify_signature(&value, "session-mac-key").expect("verify"));
        assert!(!crypto::verify_signature(&value, "long-term-secret").expect("verify"));
    }

    #[test]
    fn control_frames_require_and_use_session_mac_key() {
        let mut without_key = LtpClient::new("ws://example.com", "client");
        without_key.thread_id = Some("thread".to_string());
        without_key.session_id = Some("session".to_string());
        let ping = without_key.build_control_envelope("ping").unwrap();
        assert!(without_key.prepare_envelope_for_offline_send(ping).is_err());

        let mut with_key = LtpClient::new("ws://example.com", "client")
            .with_secret_key("long-term")
            .with_session_mac_key("session-key");
        with_key.thread_id = Some("thread".to_string());
        with_key.session_id = Some("session".to_string());
        let ping = with_key.build_control_envelope("ping").unwrap();
        let secured = with_key.prepare_envelope_for_offline_send(ping).unwrap();
        let value = serde_json::to_value(secured).unwrap();
        assert!(crypto::verify_signature(&value, "session-key").unwrap());
        assert!(!crypto::verify_signature(&value, "long-term").unwrap());
    }

    #[tokio::test]
    async fn receive_snapshot_preserves_resume_and_new_session_resets() {
        let mut client = LtpClient::new("ws://example.com", "client");
        client.thread_id = Some("thread-1".to_string());
        client.session_id = Some("session-1".to_string());
        {
            let mut state = client.receive_security.lock().await;
            state.session_id = Some("session-1".to_string());
            state.last_received_hash = Some("hash-1".to_string());
            state.seen_nonces.insert("nonce-1".to_string());
        }
        let snapshot = client.export_receive_security_snapshot().await.unwrap();
        let mut restored = LtpClient::new("ws://example.com", "client");
        restored
            .restore_receive_security_snapshot(snapshot)
            .await
            .unwrap();
        let resumed = HandshakeAck {
            r#type: "handshake_ack".to_string(),
            ltp_version: "0.6".to_string(),
            thread_id: "thread-1".to_string(),
            session_id: "session-1".to_string(),
            resumed: true,
            server_capabilities: None,
            heartbeat_interval_ms: 1000,
            metadata: None,
            server_public_key: None,
            server_ecdh_public_key: None,
            server_ecdh_signature: None,
            server_ecdh_timestamp: None,
            key_agreement: None,
        };
        restored
            .prepare_receive_security_for_ack(Some("session-1"), &resumed)
            .await
            .unwrap();
        assert_eq!(
            restored
                .receive_security
                .lock()
                .await
                .last_received_hash
                .as_deref(),
            Some("hash-1")
        );

        let fresh = HandshakeAck {
            session_id: "session-2".to_string(),
            resumed: false,
            ..resumed
        };
        restored
            .prepare_receive_security_for_ack(Some("session-1"), &fresh)
            .await
            .unwrap();
        let state = restored.receive_security.lock().await;
        assert!(state.last_received_hash.is_none());
        assert!(state.seen_nonces.is_empty());
    }

    #[test]
    fn nonce_replay_is_rejected_without_evicting_security_state() {
        let timestamp = now_ms();
        let message = serde_json::json!({
            "nonce": format!("hmac-0123456789abcdef0123456789abcdef-{}", timestamp)
        });
        let mut seen = HashSet::new();
        validate_nonce(&message, &mut seen).expect("first nonce");
        assert!(validate_nonce(&message, &mut seen).is_err());
        assert_eq!(seen.len(), 1);
    }
}

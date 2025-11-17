use crate::error::{LtpError, Result};
use crate::types::*;
use futures_util::{SinkExt, StreamExt};
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
        }
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

        // Start message handling loop (simplified - in production would be more robust)
        tokio::spawn(async move {
            while let Some(msg) = read.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        // Handle incoming messages
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
        let init = HandshakeInit {
            r#type: "handshake_init".to_string(),
            ltp_version: "0.3".to_string(),
            client_id: self.client_id.clone(),
            device_fingerprint: self.device_fingerprint.clone(),
            intent: self.intent.clone(),
            capabilities: self.capabilities.clone(),
            metadata: self.metadata.clone(),
        };

        let json = serde_json::to_string(&init)?;
        self.send_text(json).await
    }

    async fn send_handshake_resume(&mut self) -> Result<()> {
        let resume = HandshakeResume {
            r#type: "handshake_resume".to_string(),
            ltp_version: "0.3".to_string(),
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

    async fn send_text(&mut self, text: String) -> Result<()> {
        if let Some(ref mut write) = self.write {
            write.send(Message::Text(text)).await?;
            Ok(())
        } else {
            Err(LtpError::NotConnected)
        }
    }

    async fn send_envelope(&mut self, envelope: LtpEnvelope) -> Result<()> {
        let json = serde_json::to_string(&envelope)?;
        self.send_text(json).await
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
            nonce: Some(uuid::Uuid::new_v4().to_string()),
            signature: Some("v0-placeholder".to_string()),
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
            nonce: Some(uuid::Uuid::new_v4().to_string()),
            signature: Some("v0-placeholder".to_string()),
        })
    }
}

#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


# JavaScript: honor all public security options.
replace_once(
    "sdk/js/src/client.ts",
    """      sessionMacKey: options.sessionMacKey,
      secretKey: options.secretKey,
      requireSignatureVerification: requireVerification,
      maxMessageAge: options.maxMessageAge || 60000, // Default 60 seconds
""",
    """      sessionMacKey: options.sessionMacKey,
      secretKey: options.secretKey,
      requireSignatureVerification: requireVerification,
      maxMessageAge: options.maxMessageAge || 60000, // Default 60 seconds
      enableEcdhKeyExchange: options.enableEcdhKeyExchange,
      enableMetadataEncryption: options.enableMetadataEncryption,
      sessionEncryptionKey: options.sessionEncryptionKey,
""",
)

# Python: authenticated resume must rotate and sign its ECDH key.
replace_once(
    "sdk/python/ltp_client/client.py",
    """        if self.thread_id:
            self.is_attempting_resume = True
            resume_payload = {
                \"type\": \"handshake_resume\",
                \"ltp_version\": LTP_VERSION,
                \"client_id\": self.client_id,
                \"thread_id\": self.thread_id,
                \"resume_reason\": \"automatic_reconnect\",
                \"client_public_key\": self._handshake_keys[0] if self._handshake_keys else None,
                \"key_agreement\": {
                    \"algorithm\": \"secp256r1\",
                    \"method\": \"ecdh\",
                    \"hkdf\": \"sha256\",
                },
            }
            await self._send_raw(resume_payload)
""",
    """        if self.thread_id:
            self.is_attempting_resume = True
            if self.enable_ecdh_key_exchange:
                public_key, private_key = generate_ecdh_key_pair()
                self._ecdh_public_key = public_key
                self._ecdh_private_key = private_key
                self._handshake_keys = (public_key, private_key)
            ecdh_public_key = self._ecdh_public_key or (
                self._handshake_keys[0] if self._handshake_keys else None
            )
            resume_payload = {
                \"type\": \"handshake_resume\",
                \"ltp_version\": LTP_VERSION,
                \"client_id\": self.client_id,
                \"thread_id\": self.thread_id,
                \"resume_reason\": \"automatic_reconnect\",
                \"client_public_key\": ecdh_public_key,
                \"client_ecdh_public_key\": ecdh_public_key if self.enable_ecdh_key_exchange else None,
                \"key_agreement\": {
                    \"algorithm\": \"secp256r1\",
                    \"method\": \"ecdh\",
                    \"hkdf\": \"sha256\",
                } if ecdh_public_key else {},
            }
            if self.enable_ecdh_key_exchange and ecdh_public_key and self.secret_key:
                timestamp = int(time.time() * 1000)
                resume_payload[\"client_ecdh_signature\"] = sign_ecdh_public_key(
                    ecdh_public_key,
                    self.client_id,
                    timestamp,
                    self.secret_key,
                )
                resume_payload[\"client_ecdh_timestamp\"] = timestamp
            await self._send_raw(resume_payload)
""",
)

# Rust: carry authenticated ECDH fields in resume messages.
replace_once(
    "sdk/rust/ltp-client/src/types.rs",
    """pub struct HandshakeResume {
    #[serde(rename = \"type\")]
    pub r#type: String,
    pub ltp_version: String,
    pub client_id: String,
    pub thread_id: String,
    pub resume_reason: String,
}
""",
    """pub struct HandshakeResume {
    #[serde(rename = \"type\")]
    pub r#type: String,
    pub ltp_version: String,
    pub client_id: String,
    pub thread_id: String,
    pub resume_reason: String,
    #[serde(skip_serializing_if = \"Option::is_none\")]
    pub client_public_key: Option<String>,
    #[serde(skip_serializing_if = \"Option::is_none\")]
    pub client_ecdh_public_key: Option<String>,
    #[serde(skip_serializing_if = \"Option::is_none\")]
    pub client_ecdh_signature: Option<String>,
    #[serde(skip_serializing_if = \"Option::is_none\")]
    pub client_ecdh_timestamp: Option<i64>,
    #[serde(skip_serializing_if = \"Option::is_none\")]
    pub key_agreement: Option<serde_json::Value>,
}
""",
)
replace_once(
    "sdk/rust/ltp-client/src/client.rs",
    """    async fn send_handshake_resume(&mut self) -> Result<()> {
        let thread_id = self.thread_id.clone().ok_or_else(|| {
            LtpError::InvalidState(\"send_handshake_resume called without thread_id\".to_string())
        })?;
        let resume = HandshakeResume {
            r#type: \"handshake_resume\".to_string(),
            ltp_version: \"0.6\".to_string(),
            client_id: self.client_id.clone(),
            thread_id,
            resume_reason: \"automatic_reconnect\".to_string(),
        };

        let json = serde_json::to_string(&resume)?;
        self.send_text(json).await
    }
""",
    """    async fn send_handshake_resume(&mut self) -> Result<()> {
        let thread_id = self.thread_id.clone().ok_or_else(|| {
            LtpError::InvalidState(\"send_handshake_resume called without thread_id\".to_string())
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
            r#type: \"handshake_resume\".to_string(),
            ltp_version: \"0.6\".to_string(),
            client_id: self.client_id.clone(),
            thread_id,
            resume_reason: \"automatic_reconnect\".to_string(),
            client_public_key: public_key.clone(),
            client_ecdh_public_key: public_key,
            client_ecdh_signature: signature,
            client_ecdh_timestamp: timestamp,
            key_agreement: private_key.map(|_| serde_json::json!({
                \"algorithm\": \"secp256r1\",
                \"method\": \"ecdh\",
                \"hkdf\": \"sha256\"
            })),
        };

        let json = serde_json::to_string(&resume)?;
        self.send_text(json).await
    }
""",
)

# Elixir high-level client: pass all security options and use millisecond timestamps.
replace_once(
    "sdk/elixir/lib/ltp/client.ex",
    """    :reconnect_config,
    :thread_id,
""",
    """    :reconnect_config,
    :enable_ecdh_key_exchange,
    :enable_metadata_encryption,
    :secret_key,
    :session_mac_key,
    :session_encryption_key,
    :thread_id,
""",
)
replace_once(
    "sdk/elixir/lib/ltp/client.ex",
    """      reconnect_config: Map.get(opts, :reconnect, %{
        max_retries: 5,
        base_delay_ms: 1_000,
        max_delay_ms: 30_000
      }),
      is_connected: false
""",
    """      reconnect_config: Map.get(opts, :reconnect, %{
        max_retries: 5,
        base_delay_ms: 1_000,
        max_delay_ms: 30_000
      }),
      enable_ecdh_key_exchange: Map.get(opts, :enable_ecdh_key_exchange, false),
      enable_metadata_encryption: Map.get(opts, :enable_metadata_encryption, false),
      secret_key: Map.get(opts, :secret_key),
      session_mac_key: Map.get(opts, :session_mac_key),
      session_encryption_key: Map.get(opts, :session_encryption_key),
      is_connected: false
""",
)
replace_once(
    "sdk/elixir/lib/ltp/client.ex",
    """      default_context_tag: state.default_context_tag,
      default_affect: state.default_affect,
      client_pid: self()
""",
    """      default_context_tag: state.default_context_tag,
      default_affect: state.default_affect,
      enable_ecdh_key_exchange: state.enable_ecdh_key_exchange,
      enable_metadata_encryption: state.enable_metadata_encryption,
      secret_key: state.secret_key,
      session_mac_key: state.session_mac_key,
      session_encryption_key: state.session_encryption_key,
      client_pid: self()
""",
)
client_path = ROOT / "sdk/elixir/lib/ltp/client.ex"
client_text = client_path.read_text(encoding="utf-8")
client_text = client_text.replace("System.system_time(:second)", "System.system_time(:millisecond)")
client_path.write_text(client_text, encoding="utf-8")

# Elixir connection: authenticated ECDH resume must return the rotated key state.
replace_once(
    "sdk/elixir/lib/ltp/connection.ex",
    """      if state.thread_id and state.security_state_initialized do
        send_handshake_resume(state)
        state
      else
        send_handshake_init(state)
      end
""",
    """      if state.thread_id and state.security_state_initialized do
        send_handshake_resume(state)
      else
        send_handshake_init(state)
      end
""",
)
replace_once(
    "sdk/elixir/lib/ltp/connection.ex",
    """  defp send_handshake_resume(state) do
    handshake = %{
      type: \"handshake_resume\",
      ltp_version: @ltp_version,
      client_id: state.client_id,
      thread_id: state.thread_id,
      resume_reason: \"automatic_reconnect\"
    }

    WebSockex.send_frame(self(), {:text, Jason.encode!(handshake)})
  end
""",
    """  defp send_handshake_resume(state) do
    {public_key, private_key} =
      if state.enable_ecdh_key_exchange do
        LTP.Crypto.generate_ecdh_key_pair()
      else
        {nil, nil}
      end

    state = %{state | ecdh_public_key: public_key, ecdh_private_key: private_key}

    handshake = %{
      type: \"handshake_resume\",
      ltp_version: @ltp_version,
      client_id: state.client_id,
      thread_id: state.thread_id,
      resume_reason: \"automatic_reconnect\"
    }

    handshake =
      if public_key do
        handshake
        |> Map.put(:client_public_key, public_key)
        |> Map.put(:client_ecdh_public_key, public_key)
        |> Map.put(:key_agreement, %{
          algorithm: \"secp256r1\",
          method: \"ecdh\",
          hkdf: \"sha256\"
        })
      else
        handshake
      end

    handshake =
      if public_key and state.secret_key do
        timestamp = System.system_time(:millisecond)

        handshake
        |> Map.put(
          :client_ecdh_signature,
          LTP.Crypto.sign_ecdh_public_key(
            public_key,
            state.client_id,
            timestamp,
            state.secret_key
          )
        )
        |> Map.put(:client_ecdh_timestamp, timestamp)
      else
        handshake
      end

    WebSockex.send_frame(self(), {:text, Jason.encode!(handshake)})
    state
  rescue
    error ->
      Logger.error("[LTP] Failed to build resume handshake: #{Exception.message(error)}")
      state
  end
""",
)

# Reference server: accept the two existing wire versions while keeping session binding explicit.
replace_once(
    "tools/reference-server/server.ts",
    """  maxFutureSkewMs?: number;
  seed?: string;
  clock?: () => number;
""",
    """  maxFutureSkewMs?: number;
  supportedProtocolVersions?: string[];
  seed?: string;
  clock?: () => number;
""",
)
replace_once(
    "tools/reference-server/server.ts",
    """interface SessionState extends SessionKeys {
  clientId: string;
  threadId: string;
""",
    """interface SessionState extends SessionKeys {
  clientId: string;
  protocolVersion: string;
  threadId: string;
""",
)
replace_once(
    "tools/reference-server/server.ts",
    """  private readonly maxFutureSkewMs: number;
  private readonly seed: string;
""",
    """  private readonly maxFutureSkewMs: number;
  private readonly supportedProtocolVersions: string[];
  private readonly seed: string;
""",
)
replace_once(
    "tools/reference-server/server.ts",
    """    this.maxFutureSkewMs = options.maxFutureSkewMs ?? 5_000;
    this.seed = options.seed ?? \"reference\";
""",
    """    this.maxFutureSkewMs = options.maxFutureSkewMs ?? 5_000;
    this.supportedProtocolVersions = options.supportedProtocolVersions ?? [\"0.3\", \"0.6\"];
    this.seed = options.seed ?? \"reference\";
""",
)
replace_once(
    "tools/reference-server/server.ts",
    """      thread_id: state.threadId,
      session_id: state.sessionId,
""",
    """      protocol_version: state.protocolVersion,
      thread_id: state.threadId,
      session_id: state.sessionId,
""",
)
replace_once(
    "tools/reference-server/server.ts",
    """    if (frame.ltp_version !== this.protocolVersion) {
""",
    """    if (!this.supportedProtocolVersions.includes(frame.ltp_version)) {
""",
)
replace_once(
    "tools/reference-server/server.ts",
    """        supported_versions: [this.protocolVersion],
""",
    """        supported_versions: [...this.supportedProtocolVersions],
""",
)
replace_once(
    "tools/reference-server/server.ts",
    """      ltp_version: this.protocolVersion,
      thread_id: state.threadId,
""",
    """      ltp_version: state.protocolVersion,
      thread_id: state.threadId,
""",
)
replace_once(
    "tools/reference-server/server.ts",
    """      clientId: frame.client_id,
      threadId,
""",
    """      clientId: frame.client_id,
      protocolVersion: frame.ltp_version,
      threadId,
""",
)
replace_once(
    "tools/reference-server/server.ts",
    """    const state = this.sessions.get(frame.thread_id);
    if (!state || state.clientId !== frame.client_id) {
""",
    """    const state = this.sessions.get(frame.thread_id);
    if (!state || state.clientId !== frame.client_id) {
""",
)
replace_once(
    "tools/reference-server/server.ts",
    """      return;
    }

    const previousSocket = state.activeSocket;
""",
    """      return;
    }
    if (frame.ltp_version !== state.protocolVersion) {
      this.record("inbound", frame.type, "REJECTED", "SESSION_VERSION_MISMATCH", raw, state);
      const reject: HandshakeReject = {
        type: "handshake_reject",
        ltp_version: state.protocolVersion,
        reason: "session_version_mismatch",
        suggest_new: true,
        supported_versions: [...this.supportedProtocolVersions],
      };
      this.sendPlain(socket, reject, "SESSION_VERSION_MISMATCH", state);
      return;
    }

    const previousSocket = state.activeSocket;
""",
)

print("WP2 wire compatibility patch applied")

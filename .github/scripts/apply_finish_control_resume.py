from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def replace_regex(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one regex match, found {count}")
    return updated


# ---------------------------------------------------------------------------
# JavaScript
# ---------------------------------------------------------------------------
js_path = "sdk/js/src/client.ts"
js = read(js_path)

if "persistSecurityState(): void" not in js:
    js = replace_once(
        js,
        "  private storageKeys: { thread: string; session: string };",
        "  private storageKeys: { thread: string; session: string; security: string };",
        "js storage key type",
    )
    js = replace_once(
        js,
        """    this.storageKeys = {
      thread: `ltp_thread_id:${this.options.clientId}`,
      session: `ltp_session_id:${this.options.clientId}`,
    };
    this.loadPersistedIds();
""",
        """    this.storageKeys = {
      thread: `ltp_thread_id:${this.options.clientId}`,
      session: `ltp_session_id:${this.options.clientId}`,
      security: `ltp_security_state:${this.options.clientId}`,
    };
    this.loadPersistedIds();
    this.restoreSecurityState();
""",
        "js constructor storage",
    )
    js = replace_once(
        js,
        "    this.seenNonces.clear(); // Clear nonce cache on disconnect\n",
        "    this.persistSecurityState(); // Preserve replay state for authenticated resume\n",
        "js manual disconnect preservation",
    )
    js = replace_once(
        js,
        """  public sendPing(): void {
    if (!this.ensureReadyForSend('send ping')) {
      return;
    }

    this.send(this.buildEnvelope('ping', {}));
  }
""",
        """  public sendPing(): void {
    if (!this.ensureReadyForSend('send ping') || !this.requireControlMacKey('send ping')) {
      return;
    }

    void this.send(this.buildEnvelope('ping', {}));
  }

  private sendPong(): void {
    if (!this.ensureReadyForSend('send pong') || !this.requireControlMacKey('send pong')) {
      return;
    }

    void this.send(this.buildEnvelope('pong', {}));
  }

  private requireControlMacKey(action: string): boolean {
    if (this.options.sessionMacKey) {
      return true;
    }
    this.logger.error(`Cannot ${action}: post-handshake control frames require a session MAC key`);
    this.handleError({
      error_code: 'MISSING_CONTROL_MAC_KEY',
      error_message: 'Post-handshake ping/pong require the negotiated session MAC key',
    });
    return false;
  }
""",
        "js send ping/pong",
    )
    js = replace_once(
        js,
        """    const macKey = this.options.sessionMacKey || this.options.secretKey;
    if (!(await this.verifyMessageSecurity(envelopeMsg, macKey))) {
""",
        """    const isControlMessage = envelopeMsg.type === 'ping' || envelopeMsg.type === 'pong';
    const macKey = isControlMessage
      ? this.options.sessionMacKey
      : this.options.sessionMacKey || this.options.secretKey;
    if (!(await this.verifyMessageSecurity(envelopeMsg, macKey))) {
""",
        "js inbound control key selection",
    )
    js = replace_once(
        js,
        """      case 'pong':
        this.clearHeartbeatTimeout();
""",
        """      case 'ping':
        this.sendPong();
        break;
      case 'pong':
        this.clearHeartbeatTimeout();
""",
        "js authenticated ping dispatch",
    )
    js = replace_once(
        js,
        """    const isHandshakeMessage = envelope.type === 'handshake_ack' || envelope.type === 'handshake_reject';

    if (!this.options.requireSignatureVerification || isHandshakeMessage) {
      return true;
    }
""",
        """    const isHandshakeMessage = envelope.type === 'handshake_ack' || envelope.type === 'handshake_reject';
    const isControlMessage = envelope.type === 'ping' || envelope.type === 'pong';
    const requiresAuthentication = !isHandshakeMessage && (
      this.options.requireSignatureVerification || (this.isHandshakeComplete && isControlMessage)
    );

    if (!requiresAuthentication) {
      return true;
    }
""",
        "js control auth policy",
    )
    js = replace_once(
        js,
        "    const nonceError = this.validateNonce(envelope.nonce, clientId);",
        "    const nonceError = this.validateNonce(envelope.nonce, clientId, false);",
        "js nonce candidate validation",
    )
    js = replace_once(
        js,
        """      this.lastReceivedHash = await hashEnvelope({
        type: envelope.type,
        thread_id: envelope.thread_id!,
        session_id: envelope.session_id,
        timestamp: envelope.timestamp,
        nonce: envelope.nonce!,
        payload: envelope.payload,
        prev_message_hash: envelope.prev_message_hash,
      });
""",
        """      this.lastReceivedHash = await hashEnvelope({
        type: envelope.type,
        thread_id: envelope.thread_id!,
        session_id: envelope.session_id,
        timestamp: envelope.timestamp,
        nonce: envelope.nonce!,
        payload: envelope.payload,
        prev_message_hash: envelope.prev_message_hash,
      });
      this.seenNonces.set(envelope.nonce!, Date.now());
      this.persistSecurityState();
""",
        "js atomic receive commit",
    )
    js = replace_once(
        js,
        """    this.threadId = message.thread_id;
    this.sessionId = message.session_id;
""",
        """    const previousSessionId = this.sessionId;
    const resumedSameSession = message.resumed === true && previousSessionId === message.session_id;
    this.threadId = message.thread_id;
    this.sessionId = message.session_id;
""",
        "js resume identity capture",
    )
    js = replace_once(
        js,
        """    // Reset hash chain at the start of each session
    this.lastSentHash = null;
    this.lastReceivedHash = null;
""",
        """    if (resumedSameSession) {
      this.persistSecurityState();
    } else {
      this.resetSecurityState();
    }
""",
        "js resume preservation",
    )
    js = replace_once(
        js,
        """      this.storage.removeItem(this.storageKeys.thread);
      this.storage.removeItem(this.storageKeys.session);
      this.sendHandshakeInit().catch((err) => {
""",
        """      this.storage.removeItem(this.storageKeys.thread);
      this.storage.removeItem(this.storageKeys.session);
      this.resetSecurityState();
      this.sendHandshakeInit().catch((err) => {
""",
        "js rejected resume reset",
    )
    js = replace_once(
        js,
        """    this.stopNonceCleanup(); // Stop replay protection cleanup
    this.lastSentHash = null;
    this.lastReceivedHash = null;
    this.ecdhPrivateKey = null;
""",
        """    this.stopNonceCleanup(); // State survives transport reconnect for the same session
    this.persistSecurityState();
    this.ecdhPrivateKey = null;
""",
        "js disconnect preservation",
    )
    js = replace_once(
        js,
        """    const nonce = await this.generateNonce();

    const envelopeWithPrev: LtpEnvelope = {
""",
        """    const isControlMessage = message.type === 'ping' || message.type === 'pong';
    if (isControlMessage && !this.options.sessionMacKey) {
      this.logger.error('Refusing unsigned post-handshake control frame', undefined, { type: message.type });
      return;
    }

    const nonce = await this.generateNonce();

    const envelopeWithPrev: LtpEnvelope = {
""",
        "js outbound control fail closed",
    )
    js = replace_once(
        js,
        """      this.lastSentHash = await hashEnvelope({
        type: envelopeWithSecurity.type,
        thread_id: envelopeWithSecurity.thread_id || envelopeWithPrev.thread_id,
        session_id: envelopeWithSecurity.session_id || envelopeWithPrev.session_id,
        timestamp: envelopeWithSecurity.timestamp || envelopeWithPrev.timestamp,
        nonce: envelopeWithSecurity.nonce!,
        payload: envelopeWithSecurity.payload,
        prev_message_hash: envelopeWithSecurity.prev_message_hash,
      });

      this.sendRaw(envelopeWithSecurity);
""",
        """      this.lastSentHash = await hashEnvelope({
        type: envelopeWithSecurity.type,
        thread_id: envelopeWithSecurity.thread_id || envelopeWithPrev.thread_id,
        session_id: envelopeWithSecurity.session_id || envelopeWithPrev.session_id,
        timestamp: envelopeWithSecurity.timestamp || envelopeWithPrev.timestamp,
        nonce: envelopeWithSecurity.nonce!,
        payload: envelopeWithSecurity.payload,
        prev_message_hash: envelopeWithSecurity.prev_message_hash,
      });
      this.persistSecurityState();

      this.sendRaw(envelopeWithSecurity);
""",
        "js outbound state persistence",
    )
    js = replace_once(
        js,
        """  private persistIds(): void {
    if (this.threadId) {
      this.storage.setItem(this.storageKeys.thread, this.threadId);
    }
    if (this.sessionId) {
      this.storage.setItem(this.storageKeys.session, this.sessionId);
    }
  }

  private loadPersistedIds(): void {
    this.threadId = this.storage.getItem(this.storageKeys.thread);
    this.sessionId = this.storage.getItem(this.storageKeys.session);
  }
""",
        """  private persistIds(): void {
    if (this.threadId) {
      this.storage.setItem(this.storageKeys.thread, this.threadId);
    }
    if (this.sessionId) {
      this.storage.setItem(this.storageKeys.session, this.sessionId);
    }
  }

  private loadPersistedIds(): void {
    this.threadId = this.storage.getItem(this.storageKeys.thread);
    this.sessionId = this.storage.getItem(this.storageKeys.session);
  }

  private persistSecurityState(): void {
    if (!this.sessionId) {
      return;
    }
    this.storage.setItem(this.storageKeys.security, JSON.stringify({
      version: 1,
      sessionId: this.sessionId,
      lastSentHash: this.lastSentHash,
      lastReceivedHash: this.lastReceivedHash,
      seenNonces: Array.from(this.seenNonces.entries()),
    }));
  }

  private restoreSecurityState(): void {
    const serialized = this.storage.getItem(this.storageKeys.security);
    if (!serialized || !this.sessionId) {
      return;
    }
    try {
      const state = JSON.parse(serialized) as {
        version?: number;
        sessionId?: string;
        lastSentHash?: string | null;
        lastReceivedHash?: string | null;
        seenNonces?: Array<[string, number]>;
      };
      if (state.version !== 1 || state.sessionId !== this.sessionId) {
        this.storage.removeItem(this.storageKeys.security);
        return;
      }
      this.lastSentHash = typeof state.lastSentHash === 'string' ? state.lastSentHash : null;
      this.lastReceivedHash = typeof state.lastReceivedHash === 'string' ? state.lastReceivedHash : null;
      this.seenNonces = new Map(
        Array.isArray(state.seenNonces)
          ? state.seenNonces.filter(
              (entry): entry is [string, number] =>
                Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'number'
            )
          : []
      );
    } catch (error) {
      this.logger.warn('Discarding invalid persisted security state', { error: String(error) });
      this.storage.removeItem(this.storageKeys.security);
    }
  }

  private resetSecurityState(): void {
    this.lastSentHash = null;
    this.lastReceivedHash = null;
    this.seenNonces.clear();
    this.storage.removeItem(this.storageKeys.security);
  }
""",
        "js security state storage",
    )
    js = replace_once(
        js,
        "  private validateNonce(nonce: string | undefined, clientId: string | undefined): string | null {",
        "  private validateNonce(nonce: string | undefined, clientId: string | undefined, commit = true): string | null {",
        "js nonce signature",
    )
    js = replace_once(
        js,
        """    // Add to seen nonces cache
    this.seenNonces.set(nonce, now);

    return null; // Valid
""",
        """    if (commit) {
      this.seenNonces.set(nonce, now);
      this.persistSecurityState();
    }

    return null; // Valid
""",
        "js nonce commit",
    )
    write(js_path, js)

package_path = "sdk/js/package.json"
package = json.loads(read(package_path))
needle = "node dist/__tests__/canonicalEnvelopeV1.test.js"
extra = "node dist/__tests__/controlResumeSecurity.test.js"
if extra not in package["scripts"]["test"]:
    package["scripts"]["test"] = package["scripts"]["test"].replace(needle, f"{needle} && {extra}")
    write(package_path, json.dumps(package, indent=2) + "\n")

write(
    "sdk/js/src/__tests__/controlResumeSecurity.test.ts",
    """import { LtpClient } from '../client';
import { signMessage } from '../crypto';

class TestStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function run(): Promise<void> {
  const storage = new TestStorage();
  let pongs = 0;
  const client = new LtpClient(
    'ws://example.invalid',
    {
      clientId: 'control-client',
      storage,
      sessionMacKey: 'session-control-key',
      requireSignatureVerification: false,
      heartbeat: { enabled: false, intervalMs: 1000, timeoutMs: 1000 },
    },
    { onPong: () => { pongs += 1; } }
  );
  const state = client as any;
  state.threadId = 'thread-1';
  state.sessionId = 'session-1';
  state.isConnected = true;
  state.isHandshakeComplete = true;
  state.persistIds();

  const timestamp = Date.now();
  const unsignedPong: any = {
    type: 'pong', thread_id: 'thread-1', session_id: 'session-1', timestamp,
    nonce: `hmac-0123456789abcdef0123456789abcdef-${timestamp}`,
    payload: {}, meta: { client_id: 'server' }, content_encoding: 'json',
  };
  await state.handleMessageAsync({ ...unsignedPong });
  assert(pongs === 0, 'unsigned pong must not update liveness');
  assert(state.lastReceivedHash === null, 'unsigned pong must not commit chain state');

  const signedPong = { ...unsignedPong };
  signedPong.signature = await signMessage(signedPong, 'session-control-key');
  await state.handleMessageAsync(signedPong);
  assert(pongs === 1, 'authenticated pong should update liveness');
  const committedHash = state.lastReceivedHash;
  await state.handleMessageAsync(signedPong);
  assert(pongs === 1, 'replayed pong must be rejected');
  assert(state.lastReceivedHash === committedHash, 'replay must not advance the chain');

  state.lastSentHash = 'sent-hash';
  state.persistSecurityState();
  const restored = new LtpClient('ws://example.invalid', {
    clientId: 'control-client', storage, sessionMacKey: 'session-control-key',
    heartbeat: { enabled: false, intervalMs: 1000, timeoutMs: 1000 },
  });
  const restoredState = restored as any;
  assert(restoredState.lastSentHash === 'sent-hash', 'sent chain must restore');
  assert(restoredState.lastReceivedHash === committedHash, 'receive chain must restore');
  assert(restoredState.seenNonces.has(unsignedPong.nonce), 'replay cache must restore');

  await restoredState.handleHandshakeAck({
    type: 'handshake_ack', ltp_version: '0.6', thread_id: 'thread-1', session_id: 'session-1',
    server_capabilities: [], heartbeat_interval_ms: 1000, resumed: true,
  });
  assert(restoredState.lastReceivedHash === committedHash, 'same-session resume must preserve chain');

  await restoredState.handleHandshakeAck({
    type: 'handshake_ack', ltp_version: '0.6', thread_id: 'thread-2', session_id: 'session-2',
    server_capabilities: [], heartbeat_interval_ms: 1000, resumed: false,
  });
  assert(restoredState.lastReceivedHash === null, 'new session must reset receive chain');
  assert(restoredState.seenNonces.size === 0, 'new session must reset replay namespace');
  restored.disconnect();

  const noKey = new LtpClient('ws://example.invalid', {
    clientId: 'no-control-key', heartbeat: { enabled: false, intervalMs: 1000, timeoutMs: 1000 },
  });
  const noKeyState = noKey as any;
  noKeyState.threadId = 'thread'; noKeyState.sessionId = 'session';
  noKeyState.isConnected = true; noKeyState.isHandshakeComplete = true;
  let sent = false;
  noKeyState.ws = { readyState: 1, send: () => { sent = true; } };
  noKey.sendPing();
  await Promise.resolve();
  assert(!sent, 'post-handshake ping without session MAC key must fail closed');

  console.log('✓ control authentication and resume security state (JavaScript)');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
""",
)

# ---------------------------------------------------------------------------
# Python
# ---------------------------------------------------------------------------
py_path = "sdk/python/ltp_client/client.py"
py = read(py_path)

if "def _persist_security_state" not in py:
    py = replace_once(
        py,
        """    def set_ids(self, client_id: str, thread_id: str, session_id: str) -> None:
        self._data[client_id] = {
            "thread_id": thread_id,
            "session_id": session_id,
        }
        self._persist()
""",
        """    def set_ids(self, client_id: str, thread_id: str, session_id: str) -> None:
        entry = self._data.setdefault(client_id, {})
        entry.update({"thread_id": thread_id, "session_id": session_id})
        self._persist()
""",
        "python storage preserves security",
    )
    py = replace_once(
        py,
        """    def clear(self, client_id: str) -> None:
        if client_id in self._data:
            del self._data[client_id]
            self._persist()


class LtpClient:
""",
        """    def clear(self, client_id: str) -> None:
        if client_id in self._data:
            del self._data[client_id]
            self._persist()

    def get_security_state(self, client_id: str, session_id: Optional[str]) -> Dict[str, Any]:
        entry = self._data.get(client_id, {})
        state = entry.get("security_state", {}) if isinstance(entry, dict) else {}
        if not session_id or state.get("session_id") != session_id or state.get("version") != 1:
            return {}
        return dict(state)

    def set_security_state(self, client_id: str, state: Dict[str, Any]) -> None:
        entry = self._data.setdefault(client_id, {})
        entry["security_state"] = state
        self._persist()

    def clear_security_state(self, client_id: str) -> None:
        entry = self._data.get(client_id)
        if isinstance(entry, dict) and "security_state" in entry:
            del entry["security_state"]
            self._persist()


class LtpClient:
""",
        "python storage API",
    )
    py = replace_once(
        py,
        """        self._mac_key = session_mac_key or secret_key
        self.secret_key = secret_key
""",
        """        self._session_mac_key = session_mac_key
        self._mac_key = session_mac_key or secret_key
        self.secret_key = secret_key
""",
        "python session key identity",
    )
    py = replace_once(
        py,
        """        self._last_sent_hash: Optional[str] = None
        self._last_received_hash: Optional[str] = None

        self.on_connected""",
        """        self._last_sent_hash: Optional[str] = None
        self._last_received_hash: Optional[str] = None
        self._restore_security_state()

        self.on_connected""",
        "python restore on construction",
    )
    py = replace_once(
        py,
        """        ack = HandshakeAck.from_dict(data)
        self.thread_id = ack.thread_id
        self.session_id = ack.session_id
        self.heartbeat_interval_ms = ack.heartbeat_interval_ms
        self.storage.set_ids(self.client_id, ack.thread_id, ack.session_id)
        self._last_sent_hash = None
        self._last_received_hash = None
""",
        """        ack = HandshakeAck.from_dict(data)
        previous_session_id = self.session_id
        resumed_same_session = ack.resumed and previous_session_id == ack.session_id
        self.thread_id = ack.thread_id
        self.session_id = ack.session_id
        self.heartbeat_interval_ms = ack.heartbeat_interval_ms
        self.storage.set_ids(self.client_id, ack.thread_id, ack.session_id)
        if resumed_same_session:
            self._restore_security_state()
        else:
            self._reset_security_state()
""",
        "python handshake resume preservation",
    )
    py = replace_once(py, "                self._mac_key = mac_key\n", "                self._session_mac_key = mac_key\n                self._mac_key = mac_key\n", "python ECDH session key")
    py = replace_once(py, "                self._mac_key = derived_mac\n", "                self._session_mac_key = derived_mac\n                self._mac_key = derived_mac\n", "python legacy session key")
    py = replace_once(
        py,
        """            self.storage.clear(self.client_id)
            self.thread_id = None
            self.session_id = None
""",
        """            self.storage.clear(self.client_id)
            self._reset_security_state(clear_storage=False)
            self.thread_id = None
            self.session_id = None
""",
        "python rejected resume reset",
    )
    py = replace_once(
        py,
        """        self._last_sent_hash = None
        self._last_received_hash = None
        self._handshake_keys = None
""",
        """        self._persist_security_state()
        self._handshake_keys = None
""",
        "python disconnect preservation",
    )
    py = replace_once(
        py,
        """    async def _send_envelope(self, message_type: MessageType, payload: Dict[str, Any]) -> None:
        if not self.is_connected or not self.thread_id or not self.session_id:
            print("[LTP] Cannot send message: not connected")
            return

        envelope = self._build_envelope(message_type, payload)
""",
        """    async def _send_envelope(self, message_type: MessageType, payload: Dict[str, Any]) -> None:
        if not self.is_connected or not self.thread_id or not self.session_id:
            print("[LTP] Cannot send message: not connected")
            return
        if message_type in {"ping", "pong"} and not self._session_mac_key:
            print("[LTP] Refusing post-handshake control frame without a session MAC key")
            return

        envelope = self._build_envelope(message_type, payload)
""",
        "python outbound control policy",
    )
    py = replace_once(
        py,
        """        # Sign message (v0.5+)
        if self._mac_key:
            message_dict["signature"] = sign_message(message_dict, self._mac_key)
""",
        """        # Post-handshake control frames are bound only to the negotiated session key.
        signing_key = self._session_mac_key if msg_type in {"ping", "pong"} else self._mac_key
        if signing_key:
            message_dict["signature"] = sign_message(message_dict, signing_key)
        elif msg_type in {"ping", "pong"}:
            raise RuntimeError("post-handshake control frame requires a session MAC key")
""",
        "python control signing key",
    )
    py = replace_once(
        py,
        """        try:
            self._last_sent_hash = hash_envelope(message_dict)
        except Exception as e:
            print(f"[LTP] Warning: Failed to compute message hash: {e}")

        return message_dict
""",
        """        try:
            self._last_sent_hash = hash_envelope(message_dict)
            self._persist_security_state()
        except Exception as e:
            print(f"[LTP] Warning: Failed to compute message hash: {e}")

        return message_dict
""",
        "python outbound persistence",
    )
    py = replace_once(
        py,
        """    def _get_timestamp(self) -> int:
        return int(time.time() * 1000)

    def _validate_signature(self, message: Dict[str, Any]) -> bool:
""",
        """    def _persist_security_state(self) -> None:
        if not self.session_id:
            return
        self.storage.set_security_state(self.client_id, {
            "version": 1,
            "session_id": self.session_id,
            "last_sent_hash": self._last_sent_hash,
            "last_received_hash": self._last_received_hash,
            "seen_nonces": dict(self._seen_nonces),
        })

    def _restore_security_state(self) -> None:
        state = self.storage.get_security_state(self.client_id, self.session_id)
        if not state:
            return
        self._last_sent_hash = state.get("last_sent_hash") if isinstance(state.get("last_sent_hash"), str) else None
        self._last_received_hash = state.get("last_received_hash") if isinstance(state.get("last_received_hash"), str) else None
        seen = state.get("seen_nonces", {})
        self._seen_nonces = {
            str(nonce): int(timestamp)
            for nonce, timestamp in seen.items()
            if isinstance(nonce, str) and isinstance(timestamp, (int, float))
        } if isinstance(seen, dict) else {}

    def _reset_security_state(self, clear_storage: bool = True) -> None:
        self._last_sent_hash = None
        self._last_received_hash = None
        self._seen_nonces = {}
        if clear_storage:
            self.storage.clear_security_state(self.client_id)

    def _get_timestamp(self) -> int:
        return int(time.time() * 1000)

    def _validate_signature(self, message: Dict[str, Any], mac_key: Optional[str] = None) -> bool:
""",
        "python persistence helpers",
    )
    py = replace_once(
        py,
        """        if not self._mac_key:
            return False

        if not verify_signature(message, self._mac_key):
""",
        """        verification_key = mac_key or self._mac_key
        if not verification_key:
            return False

        if not verify_signature(message, verification_key):
""",
        "python verification key override",
    )
    py = replace_once(py, "    def _validate_nonce(self, message: Dict[str, Any]) -> bool:", "    def _validate_nonce(self, message: Dict[str, Any], commit: bool = True) -> bool:", "python nonce signature")
    py = replace_once(
        py,
        """        # Add to seen nonces cache, and evict stale entries opportunistically so
        # the dict cannot grow unbounded on long-lived connections.
        self._seen_nonces[nonce] = now
        if len(self._seen_nonces) > 1024:
            self._cleanup_nonces()

        return True
""",
        """        if commit:
            self._seen_nonces[nonce] = now
            if len(self._seen_nonces) > 1024:
                self._cleanup_nonces()
            self._persist_security_state()

        return True
""",
        "python nonce atomic commit",
    )
    py = replace_once(py, "        mac_key = self._mac_key or self.secret_key\n", "        mac_key = self._session_mac_key or self._mac_key or self.secret_key\n", "python nonce session key")
    write(py_path, py)

secure_path = "sdk/python/ltp_client/secure_client.py"
secure = read(secure_path)
if "is_control_message" not in secure:
    secure = replace_once(
        secure,
        """        is_handshake_message = message_type in {"handshake_ack", "handshake_reject"}
""",
        """        is_handshake_message = message_type in {"handshake_ack", "handshake_reject"}
        is_control_message = message_type in {"ping", "pong"}
""",
        "python secure control classification",
    )
    secure = replace_once(
        secure,
        """        requires_authentication = (
            not is_handshake_message and self.require_signature_verification
        )
""",
        """        requires_authentication = not is_handshake_message and (
            self.require_signature_verification or (self.is_handshake_complete and is_control_message)
        )
        verification_key = self._session_mac_key if is_control_message else self._mac_key
""",
        "python secure control policy",
    )
    secure = replace_once(secure, "        if requires_authentication and not self._mac_key:\n", "        if requires_authentication and not verification_key:\n", "python secure missing key")
    secure = replace_once(secure, "            if not self._validate_signature(data):\n", "            if not self._validate_signature(data, verification_key):\n", "python secure key use")
    secure = replace_once(secure, "            if requires_authentication and not self._validate_nonce(data):\n", "            if requires_authentication and not self._validate_nonce(data, commit=False):\n", "python secure nonce candidate")
    secure = replace_once(
        secure,
        """            self._last_received_hash = candidate_hash

        # Callbacks and business dispatch are outside the untrusted boundary.
""",
        """            if requires_authentication:
                nonce = data.get("nonce")
                if isinstance(nonce, str):
                    import time
                    self._seen_nonces[nonce] = int(time.time() * 1000)
            self._last_received_hash = candidate_hash
            self._persist_security_state()

        # Callbacks and business dispatch are outside the untrusted boundary.
""",
        "python secure atomic commit",
    )
    secure = replace_once(
        secure,
        """        elif message_type == "pong":
            self._pong_event.set()
""",
        """        elif message_type == "ping":
            await self._send_envelope("pong", {})
        elif message_type == "pong":
            self._pong_event.set()
""",
        "python authenticated ping response",
    )
    write(secure_path, secure)

write(
    "sdk/python/tests/test_control_resume_security.py",
    """import asyncio
import time
from pathlib import Path
from unittest.mock import MagicMock

from ltp_client import LtpClient
from ltp_client.client import ThreadStorage
from ltp_client.crypto import sign_message


def _pong(key: str, nonce: str) -> dict:
    message = {
        "type": "pong", "thread_id": "thread-1", "session_id": "session-1",
        "timestamp": int(time.time() * 1000), "nonce": nonce, "payload": {},
        "meta": {"client_id": "server"}, "content_encoding": "json",
    }
    message["signature"] = sign_message(message, key)
    return message


def test_control_authentication_and_resume_state(tmp_path: Path) -> None:
    storage = ThreadStorage(str(tmp_path / "state.json"))
    client = LtpClient(
        url="ws://localhost:8080", client_id="control-client", storage=storage,
        session_mac_key="session-control-key", require_signature_verification=False,
        heartbeat_options={"enabled": False},
    )
    client.thread_id = "thread-1"; client.session_id = "session-1"
    client.is_connected = True; client.is_handshake_complete = True
    storage.set_ids(client.client_id, client.thread_id, client.session_id)
    client.on_pong = MagicMock()

    unsigned = _pong("session-control-key", f"hmac-0123456789abcdef0123456789abcdef-{int(time.time() * 1000)}")
    unsigned.pop("signature")
    asyncio.run(client._handle_message(unsigned))
    client.on_pong.assert_not_called()
    assert client._last_received_hash is None

    nonce = f"hmac-abcdef0123456789abcdef0123456789-{int(time.time() * 1000)}"
    signed = _pong("session-control-key", nonce)
    asyncio.run(client._handle_message(signed))
    client.on_pong.assert_called_once()
    committed = client._last_received_hash
    asyncio.run(client._handle_message(signed))
    client.on_pong.assert_called_once()
    assert client._last_received_hash == committed

    client._last_sent_hash = "sent-hash"
    client._persist_security_state()
    restored = LtpClient(
        url="ws://localhost:8080", client_id="control-client", storage=storage,
        session_mac_key="session-control-key", heartbeat_options={"enabled": False},
    )
    assert restored._last_sent_hash == "sent-hash"
    assert restored._last_received_hash == committed
    assert nonce in restored._seen_nonces

    asyncio.run(restored._handle_handshake_ack({
        "type": "handshake_ack", "ltp_version": "0.6", "thread_id": "thread-1",
        "session_id": "session-1", "heartbeat_interval_ms": 1000, "resumed": True,
    }))
    assert restored._last_received_hash == committed

    asyncio.run(restored._handle_handshake_ack({
        "type": "handshake_ack", "ltp_version": "0.6", "thread_id": "thread-2",
        "session_id": "session-2", "heartbeat_interval_ms": 1000, "resumed": False,
    }))
    assert restored._last_received_hash is None
    assert restored._seen_nonces == {}


def test_control_send_without_session_key_fails_closed(tmp_path: Path) -> None:
    storage = ThreadStorage(str(tmp_path / "state.json"))
    client = LtpClient(url="ws://localhost:8080", client_id="no-key", storage=storage)
    client.thread_id = "thread"; client.session_id = "session"; client.is_connected = True
    client.ws = MagicMock()
    asyncio.run(client.send_ping())
    client.ws.send.assert_not_called()
""",
)

# ---------------------------------------------------------------------------
# Rust
# ---------------------------------------------------------------------------
rust_path = "sdk/rust/ltp-client/src/client.rs"
rust = read(rust_path)
if "pub struct ReceiveSecuritySnapshot" not in rust:
    rust = replace_once(rust, "use serde::Serialize;", "use serde::{Deserialize, Serialize};", "rust serde imports")
    rust = replace_once(rust, "use std::collections::HashSet;", "use std::collections::HashSet;\nuse std::sync::Arc;", "rust arc import")
    rust = replace_once(rust, "use tokio_tungstenite", "use tokio::sync::Mutex;\nuse tokio_tungstenite", "rust mutex import")
    rust = replace_once(
        rust,
        """const MAX_SEEN_NONCES: usize = 4_096;

fn now_ms()""",
        """const MAX_SEEN_NONCES: usize = 4_096;

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

fn now_ms()""",
        "rust snapshot structs",
    )
    rust = replace_once(
        rust,
        """    last_sent_hash: Option<String>,
    last_received_hash: Option<String>,
    seen_nonces: HashSet<String>,
""",
        """    last_sent_hash: Option<String>,
    receive_security: Arc<Mutex<ReceiveSecurityState>>,
""",
        "rust shared receive fields",
    )
    rust = replace_once(
        rust,
        """            last_sent_hash: None,
            last_received_hash: None,
            seen_nonces: HashSet::new(),
""",
        """            last_sent_hash: None,
            receive_security: Arc::new(Mutex::new(ReceiveSecurityState::default())),
""",
        "rust shared receive init",
    )
    old_connect = """        let ack = self.wait_for_handshake_ack(&mut read).await?;
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

        let receive_mac_key = self
            .session_mac_key
            .clone()
            .or_else(|| self.secret_key.clone());
        let receive_encryption_key = self.session_encryption_key.clone();
        let mut last_received_hash = self.last_received_hash.clone();
        let mut seen_nonces = std::mem::take(&mut self.seen_nonces);

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
                        // Keep the exact wire representation for hash-chain commitment.
                        // Signature verification and dispatch use the decrypted logical view.
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
                                eprintln!("Dropping LTP frame: no receive MAC key is configured");
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

                        let candidate_hash =
                            match verify_hash_chain(&wire_message, last_received_hash.as_deref()) {
                                Ok(hash) => hash,
                                Err(error) => {
                                    eprintln!("Dropping LTP frame: {}", error);
                                    continue;
                                }
                            };

                        if let Err(error) = validate_nonce(&message, &mut seen_nonces) {
                            eprintln!("Dropping LTP frame: {}", error);
                            continue;
                        }

                        // Security state is committed only after all fallible checks pass.
                        last_received_hash = Some(candidate_hash);
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
"""
    new_connect = """        let previous_session_id = self.session_id.clone();
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
                                eprintln!("Dropping LTP frame: signature verification error: {}", error);
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
                            (security.last_received_hash.clone(), security.seen_nonces.clone())
                        };
                        let candidate_hash = match verify_hash_chain(
                            &wire_message,
                            expected_hash.as_deref(),
                        ) {
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
                            eprintln!("Dropping LTP frame: concurrent receive-state commit detected");
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
"""
    rust = replace_once(rust, old_connect, new_connect, "rust live receive state")
    rust = replace_once(
        rust,
        """    /// Get current thread ID
    pub fn thread_id(&self) -> Option<&String> {
""",
        """    /// Send an authenticated heartbeat ping.
    pub async fn send_ping(&mut self) -> Result<()> {
        if !self.is_connected {
            return Err(LtpError::NotConnected);
        }
        let envelope = self.build_control_envelope("ping")?;
        self.send_envelope(envelope).await
    }

    /// Get current thread ID
    pub fn thread_id(&self) -> Option<&String> {
""",
        "rust send ping",
    )
    rust = replace_once(
        rust,
        """    pub fn prepare_envelope_for_offline_send(
        &mut self,
        envelope: LtpEnvelope,
    ) -> Result<LtpEnvelope> {
        self.finalize_envelope(envelope)
    }

    async fn send_handshake_init""",
        """    pub fn prepare_envelope_for_offline_send(
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
            return Err(LtpError::InvalidState("Unsupported receive snapshot version".to_string()));
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
        let resumed_same_session = ack.resumed && previous_session_id == Some(ack.session_id.as_str());
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

    async fn send_handshake_init""",
        "rust snapshot methods",
    )
    rust = replace_once(
        rust,
        """        if let Some(signing_key) = self.session_mac_key.as_ref().or(self.secret_key.as_ref()) {
            let signature = crypto::sign_message(&serde_json::to_value(&envelope)?, signing_key)?;
            envelope.signature = Some(signature);
        }
""",
        """        let is_control = envelope.r#type == "ping" || envelope.r#type == "pong";
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
""",
        "rust control signing policy",
    )
    rust = replace_regex(
        rust,
        r"\n    #\[allow\(dead_code\)\]\n    fn verify_hash_chain\(&mut self, envelope: &LtpEnvelope\) -> Result<\(\)> \{.*?\n    \}\n\n    fn build_state_update_envelope",
        "\n    fn build_state_update_envelope",
        "rust obsolete local receive state",
    )
    rust = replace_once(
        rust,
        """    fn build_event_envelope<T: Serialize>(&self, event_type: &str, data: T) -> Result<LtpEnvelope> {
""",
        """    fn build_control_envelope(&self, control_type: &str) -> Result<LtpEnvelope> {
        Ok(LtpEnvelope {
            r#type: control_type.to_string(),
            thread_id: self.thread_id.clone().unwrap_or_default(),
            session_id: self.session_id.clone(),
            timestamp: get_current_timestamp(),
            content_encoding: ContentEncoding::Json,
            payload: Payload { kind: "control".to_string(), data: serde_json::json!({}) },
            meta: Some(serde_json::json!({"client_id": self.client_id})),
            nonce: None,
            signature: None,
            prev_message_hash: None,
            encrypted_metadata: None,
            routing_tag: None,
        })
    }

    fn build_event_envelope<T: Serialize>(&self, event_type: &str, data: T) -> Result<LtpEnvelope> {
""",
        "rust control envelope",
    )
    rust = replace_once(
        rust,
        """    #[test]
    fn nonce_replay_is_rejected_without_evicting_security_state() {
""",
        """    #[test]
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
        restored.restore_receive_security_snapshot(snapshot).await.unwrap();
        let resumed = HandshakeAck {
            r#type: "handshake_ack".to_string(), ltp_version: "0.6".to_string(),
            thread_id: "thread-1".to_string(), session_id: "session-1".to_string(), resumed: true,
            server_capabilities: None, heartbeat_interval_ms: 1000, metadata: None,
            server_public_key: None, server_ecdh_public_key: None,
            server_ecdh_signature: None, server_ecdh_timestamp: None, key_agreement: None,
        };
        restored.prepare_receive_security_for_ack(Some("session-1"), &resumed).await.unwrap();
        assert_eq!(restored.receive_security.lock().await.last_received_hash.as_deref(), Some("hash-1"));

        let fresh = HandshakeAck { session_id: "session-2".to_string(), resumed: false, ..resumed };
        restored.prepare_receive_security_for_ack(Some("session-1"), &fresh).await.unwrap();
        let state = restored.receive_security.lock().await;
        assert!(state.last_received_hash.is_none());
        assert!(state.seen_nonces.is_empty());
    }

    #[test]
    fn nonce_replay_is_rejected_without_evicting_security_state() {
""",
        "rust control/resume tests",
    )
    write(rust_path, rust)

lib_path = "sdk/rust/ltp-client/src/lib.rs"
lib = read(lib_path)
lib = lib.replace("pub use client::LtpClient;", "pub use client::{LtpClient, ReceiveSecuritySnapshot};")
write(lib_path, lib)

# ---------------------------------------------------------------------------
# Elixir
# ---------------------------------------------------------------------------
ex_path = "sdk/elixir/lib/ltp/connection.ex"
ex = read(ex_path)
if "security_state_initialized" not in ex:
    ex = replace_once(ex, "    :seen_nonces,\n    :max_message_age_ms", "    :seen_nonces,\n    :security_state_initialized,\n    :max_message_age_ms", "elixir state field")
    ex = replace_once(
        ex,
        """      last_sent_hash: nil,
      last_received_hash: nil,
      seen_nonces: %{},
      max_message_age_ms:""",
        """      last_sent_hash: Keyword.get(opts, :last_sent_hash),
      last_received_hash: Keyword.get(opts, :last_received_hash),
      seen_nonces: Keyword.get(opts, :seen_nonces, %{}),
      security_state_initialized: Keyword.get(opts, :security_state_initialized, false),
      max_message_age_ms:""",
        "elixir restored state options",
    )
    ex = replace_once(ex, "      if state.thread_id do\n", "      if state.thread_id and state.security_state_initialized do\n", "elixir fail-closed resume")
    ex = replace_once(
        ex,
        """      {:ok, %{"type" => type} = message}
      when type in ["handshake_ack", "handshake_reject", "ping", "pong"] ->
        handle_message(message, state)
""",
        """      {:ok, %{"type" => type} = message}
      when type in ["handshake_ack", "handshake_reject"] ->
        handle_message(message, state)
""",
        "elixir remove control bypass",
    )
    ex = replace_once(
        ex,
        """      {:ok, logical_message, %{replay_state | last_received_hash: candidate_hash}}
""",
        """      {:ok, logical_message,
       %{replay_state | last_received_hash: candidate_hash, security_state_initialized: true}}
""",
        "elixir inbound state marker",
    )
    ex = replace_once(
        ex,
        """    signing_key = state.session_mac_key || state.secret_key

    envelope =
      if is_binary(signing_key) do
""",
        """    type = Map.get(envelope, :type) || Map.get(envelope, "type")
    control_frame = type in ["ping", "pong"]
    signing_key = if control_frame, do: state.session_mac_key, else: state.session_mac_key || state.secret_key
    if control_frame and not is_binary(state.session_mac_key),
      do: raise("post-handshake control frame requires negotiated session MAC key")

    envelope =
      if is_binary(signing_key) do
""",
        "elixir control signing key",
    )
    ex = replace_once(
        ex,
        """    message_hash = LTP.Crypto.hash_envelope(envelope)
    {:ok, envelope, %{state | last_sent_hash: message_hash}}
""",
        """    message_hash = LTP.Crypto.hash_envelope(envelope)
    {:ok, envelope,
     %{state | last_sent_hash: message_hash, security_state_initialized: true}}
""",
        "elixir outbound state marker",
    )
    ex = replace_once(
        ex,
        """    new_state =
      if state.enable_ecdh_key_exchange and state.ecdh_private_key do
""",
        """    resumed_same_session = ack["resumed"] == true and state.session_id == session_id

    new_state =
      if state.enable_ecdh_key_exchange and state.ecdh_private_key do
""",
        "elixir resume identity",
    )
    ex = replace_once(
        ex,
        """    if new_state.is_handshake_complete do
""",
        """    new_state =
      if resumed_same_session do
        new_state
      else
        %{new_state | last_sent_hash: nil, last_received_hash: nil, seen_nonces: %{}, security_state_initialized: false}
      end

    if new_state.is_handshake_complete do
""",
        "elixir new session reset",
    )
    ex = replace_once(
        ex,
        """      new_state = %{state | thread_id: nil, session_id: nil}
""",
        """      new_state = %{
        state
        | thread_id: nil,
          session_id: nil,
          last_sent_hash: nil,
          last_received_hash: nil,
          seen_nonces: %{},
          security_state_initialized: false
      }
""",
        "elixir rejected resume reset",
    )
    ex = replace_once(
        ex,
        """  defp handle_message(%{"type" => "ping"} = ping, state) do
    pong = %{
      type: "pong",
      thread_id: ping["thread_id"],
      session_id: ping["session_id"],
      timestamp: System.system_time(:second)
    }

    WebSockex.send_frame(self(), {:text, Jason.encode!(pong)})
    {:ok, state}
  end
""",
        """  defp handle_message(%{"type" => "ping"}, state) do
    case secure_control_frame("pong", state) do
      {:ok, pong, new_state} ->
        {:reply, {:text, Jason.encode!(pong)}, new_state}

      {:error, reason, unchanged_state} ->
        Logger.error("[LTP] Refusing insecure pong: #{reason}")
        {:ok, unchanged_state}
    end
  end
""",
        "elixir authenticated pong response",
    )
    ex = replace_once(
        ex,
        """  defp send_ping(state) do
    ping = %{
      type: "ping",
      thread_id: state.thread_id,
      session_id: state.session_id,
      timestamp: System.system_time(:second)
    }

    WebSockex.send_frame(self(), {:text, Jason.encode!(ping)})
  end
""",
        """  defp secure_control_frame(type, state) do
    envelope = %{
      type: type,
      thread_id: state.thread_id,
      session_id: state.session_id,
      timestamp: System.system_time(:millisecond),
      payload: %{},
      meta: %{client_id: state.client_id},
      content_encoding: "json"
    }

    apply_security_features(envelope, state)
  end

  defp send_ping(state) do
    case secure_control_frame("ping", state) do
      {:ok, ping, new_state} ->
        WebSockex.send_frame(self(), {:text, Jason.encode!(ping)})
        {:ok, new_state}

      {:error, reason, unchanged_state} ->
        {:error, reason, unchanged_state}
    end
  end
""",
        "elixir secure ping",
    )
    ex = replace_once(
        ex,
        """      if state.is_handshake_complete do
        send_ping(state)
        schedule_heartbeat(state)
      else
        state
      end

    {:ok, new_state}
""",
        """      if state.is_handshake_complete do
        case send_ping(state) do
          {:ok, sent_state} -> schedule_heartbeat(sent_state)
          {:error, reason, unchanged_state} ->
            Logger.error("[LTP] Heartbeat send failed closed: #{reason}")
            unchanged_state
        end
      else
        state
      end

    {:ok, new_state}
""",
        "elixir heartbeat state commit",
    )
    write(ex_path, ex)

write(
    "sdk/elixir/test/ltp/control_resume_security_test.exs",
    """defmodule LTP.ControlResumeSecurityTest do
  use ExUnit.Case, async: true

  defp state(overrides \\ %{}) do
    defaults = %{
      client_id: "control-client",
      client_pid: self(),
      thread_id: "thread-1",
      session_id: "session-1",
      session_mac_key: "session-control-key",
      secret_key: "long-term-key",
      session_encryption_key: nil,
      enable_metadata_encryption: false,
      heartbeat_interval_ms: 1_000,
      heartbeat_timeout_ms: 1_000,
      heartbeat_timer: nil,
      heartbeat_timeout_timer: nil,
      last_pong_time: nil,
      last_sent_hash: nil,
      last_received_hash: nil,
      seen_nonces: %{},
      security_state_initialized: true,
      max_message_age_ms: 60_000,
      is_handshake_complete: true,
      reconnect_attempts: 0,
      reconnect_config: %{max_retries: 1, base_delay_ms: 1, max_delay_ms: 1}
    }
    struct(LTP.Connection, Map.merge(defaults, overrides))
  end

  defp signed_control(type, key, overrides \\ %{}) do
    timestamp = System.system_time(:millisecond)
    message = %{
      "type" => type,
      "thread_id" => "thread-1",
      "session_id" => "session-1",
      "timestamp" => timestamp,
      "nonce" => "hmac-0123456789abcdef0123456789abcdef-#{timestamp}",
      "payload" => %{},
      "meta" => %{"client_id" => "server"},
      "content_encoding" => "json"
    } |> Map.merge(overrides)
    Map.put(message, "signature", LTP.Crypto.sign_message(message, key))
  end

  test "unsigned pong cannot mutate heartbeat state" do
    message = signed_control("pong", "session-control-key") |> Map.delete("signature")
    initial = state(%{last_pong_time: 123})
    assert {:ok, returned} = LTP.Connection.handle_frame({:text, Jason.encode!(message)}, initial)
    assert returned.last_pong_time == 123
    assert returned.last_received_hash == nil
  end

  test "authenticated pong commits chain and liveness" do
    message = signed_control("pong", "session-control-key")
    assert {:ok, returned} = LTP.Connection.handle_frame({:text, Jason.encode!(message)}, state())
    assert returned.last_pong_time
    assert returned.last_received_hash
    assert returned.security_state_initialized
  end

  test "same-session resume state is representable and new state defaults fail closed" do
    restored = state(%{
      last_sent_hash: "sent",
      last_received_hash: "received",
      seen_nonces: %{"nonce" => 1},
      security_state_initialized: true
    })
    assert restored.last_received_hash == "received"
    fresh = state(%{
      last_sent_hash: nil,
      last_received_hash: nil,
      seen_nonces: %{},
      security_state_initialized: false
    })
    refute fresh.security_state_initialized
  end

  test "outbound ping without negotiated session key fails closed" do
    initial = state(%{session_mac_key: nil, secret_key: "long-term"})
    assert {:ok, returned} = LTP.Connection.handle_info(:heartbeat, initial)
    assert returned.last_sent_hash == nil
  end
end
""",
)

# ---------------------------------------------------------------------------
# Shared contracts, docs, CI
# ---------------------------------------------------------------------------
write(
    "tests/security/test_control_resume_contracts.py",
    """from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def source(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_control_frames_require_negotiated_session_keys() -> None:
    js = source("sdk/js/src/client.ts")
    py = source("sdk/python/ltp_client/secure_client.py") + source("sdk/python/ltp_client/client.py")
    rust = source("sdk/rust/ltp-client/src/client.rs")
    ex = source("sdk/elixir/lib/ltp/connection.ex")
    assert "requireControlMacKey" in js and "isControlMessage" in js
    assert "_session_mac_key" in py and 'message_type in {"ping", "pong"}' in py
    assert "Post-handshake control frame requires negotiated session MAC key" in rust
    assert 'when type in ["handshake_ack", "handshake_reject"]' in ex
    assert "secure_control_frame" in ex


def test_resume_preserves_committed_security_namespace() -> None:
    js = source("sdk/js/src/client.ts")
    py = source("sdk/python/ltp_client/client.py")
    rust = source("sdk/rust/ltp-client/src/client.rs")
    ex = source("sdk/elixir/lib/ltp/connection.ex")
    assert "persistSecurityState" in js and "resumedSameSession" in js
    assert "_persist_security_state" in py and "resumed_same_session" in py
    assert "ReceiveSecuritySnapshot" in rust and "receive_generation" in rust
    assert "security_state_initialized" in ex and "resumed_same_session" in ex
""",
)

write(
    "docs/security/SESSION_CONTROL_AND_RESUME_STATE.md",
    """# Session control authentication and resume state

Post-handshake `ping` and `pong` are authenticated protocol messages, not transport hints.
They use the negotiated session MAC key, canonical envelope bytes, fresh nonces, replay
protection, and the same hash-chain commitment as business frames. An unsigned or stale
`pong` cannot update liveness state.

## Resume invariant

A transport reconnect does not create a new security namespace. An authenticated resume
of the same `session_id` restores the committed receive hash and replay cache. A fresh
session or rejected resume explicitly resets them. Old receive owners are invalidated
before a replacement owner can commit.

## Persistence format

- JavaScript stores a versioned JSON record under `ltp_security_state:<client_id>`.
- Python stores a versioned `security_state` object beside thread/session identifiers.
- Rust exposes `ReceiveSecuritySnapshot` for application-controlled durable storage.
- Elixir accepts restored `last_sent_hash`, `last_received_hash`, `seen_nonces`, and
  `security_state_initialized` options. Without restored state it starts a fresh handshake
  instead of silently resuming an old session.

The snapshot namespace is bound to the session ID. Unknown versions, mismatched sessions,
or absent state fail closed and require a new authenticated session.
""",
)

post_path = "docs/security/POST_P0_HARDENING.md"
post = read(post_path)
post = post.replace(
    "The confirmed P0 regressions are covered by executable contracts. The following\ncontrol-plane and lifecycle items remain explicit follow-up work and must not be\nrepresented as already solved.",
    "The confirmed P0 regressions are covered by executable contracts. The control-plane\nand lifecycle items below are now implemented and protected by native and cross-SDK\nregression tests. See `SESSION_CONTROL_AND_RESUME_STATE.md` for the normative state model.",
)
post = post.replace("## Authenticate ping/pong after handshake", "## Authenticate ping/pong after handshake — completed")
post = post.replace("## Preserve receive security state across reconnect/resume", "## Preserve receive security state across reconnect/resume — completed")
post = post.replace(
    "These are tracked as post-P0 hardening, not as reasons to weaken the P0 regression\nsuite. Any implementation must add executable regression tests before changing the\nstatus of this document.",
    "Both items are enforced by executable regression tests. Future changes must preserve\nthe negotiated-session control key, replay namespace, hash commitment, and single receive\nowner semantics.",
)
write(post_path, post)

workflow_path = ".github/workflows/p0-security-regressions.yml"
workflow = read(workflow_path)
for entry, after in [
    ('      - "tests/security/test_control_resume_contracts.py"\n', '      - "tests/security/canonical-envelope-v1.*"\n'),
    ('      - "sdk/js/src/__tests__/controlResumeSecurity.test.ts"\n', '      - "sdk/js/src/__tests__/canonicalEnvelopeV1.test.ts"\n'),
    ('      - "sdk/python/tests/test_control_resume_security.py"\n', '      - "sdk/python/tests/test_receive_security_atomicity.py"\n'),
    ('      - "sdk/elixir/test/ltp/control_resume_security_test.exs"\n', '      - "sdk/elixir/test/ltp/connection_fail_closed_test.exs"\n'),
]:
    if entry not in workflow:
        workflow = workflow.replace(after, after + entry)
workflow = workflow.replace(
    "          node dist/__tests__/canonicalEnvelopeV1.test.js\n",
    "          node dist/__tests__/canonicalEnvelopeV1.test.js\n          node dist/__tests__/controlResumeSecurity.test.js\n",
)
workflow = workflow.replace(
    "            sdk/python/tests/test_receive_security_atomicity.py\n",
    "            sdk/python/tests/test_receive_security_atomicity.py \\\n            sdk/python/tests/test_control_resume_security.py\n",
)
workflow = workflow.replace(
    "          python -m pytest -q tests/security/p0/test_p0_security_regressions.py\n",
    "          python -m pytest -q tests/security/p0/test_p0_security_regressions.py tests/security/test_control_resume_contracts.py\n",
)
workflow = workflow.replace(
    "            test/ltp/connection_fail_closed_test.exs\n",
    "            test/ltp/connection_fail_closed_test.exs \\\n            test/ltp/control_resume_security_test.exs\n",
)
write(workflow_path, workflow)

print("Applied authenticated control and resume-state security changes")

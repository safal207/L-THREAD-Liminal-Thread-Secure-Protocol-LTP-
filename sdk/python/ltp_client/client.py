"""
LTP (Liminal Thread Protocol) Python Client
Version 0.3
"""

import asyncio
import json
import os
import platform
import secrets
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple
from uuid import uuid4

try:
    import websockets
    from websockets.client import WebSocketClientProtocol
except ImportError:  # pragma: no cover - dependency hint
    websockets = None
    WebSocketClientProtocol = Any

from .types import (
    HandshakeInit,
    HandshakeAck,
    LtpEnvelope,
    LtpMeta,
    ErrorPayload,
    MessageType,
)
from .crypto import (
    sign_message,
    verify_signature,
    generate_ecdh_key_pair,
    derive_shared_secret,
    derive_session_keys,
    sign_ecdh_public_key,
    verify_ecdh_public_key,
    hash_envelope,
    hmac_sha256,
    encrypt_metadata,
    decrypt_metadata,
    generate_routing_tag,
)

LTP_VERSION = "0.6"
SDK_VERSION = "0.6.0-alpha.3"
SUBPROTOCOL = "ltp.v0.6"


class ThreadStorage:
    """Simple JSON-backed storage for thread/session identifiers."""

    def __init__(self, path: Optional[str] = None) -> None:
        self.path = Path(path or os.path.expanduser("~/.ltp_client.json"))
        self._data = self._load()

    def _load(self) -> Dict[str, Dict[str, str]]:
        if self.path.exists():
            try:
                return json.loads(self.path.read_text())
            except json.JSONDecodeError:
                return {}
        return {}

    def _persist(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self._data, indent=2))

    def get_ids(self, client_id: str) -> Tuple[Optional[str], Optional[str]]:
        entry = self._data.get(client_id, {})
        return entry.get("thread_id"), entry.get("session_id")

    def set_ids(self, client_id: str, thread_id: str, session_id: str) -> None:
        self._data[client_id] = {
            "thread_id": thread_id,
            "session_id": session_id,
        }
        self._persist()

    def clear(self, client_id: str) -> None:
        if client_id in self._data:
            del self._data[client_id]
            self._persist()


class LtpClient:
    """LTP Client for establishing and managing liminal thread sessions"""

    def __init__(
        self,
        url: str,
        client_id: Optional[str] = None,
        device_fingerprint: Optional[str] = None,
        intent: str = "resonant_link",
        capabilities: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        default_context_tag: Optional[str] = None,
        default_affect: Optional[Dict[str, float]] = None,
        storage: Optional[ThreadStorage] = None,
        storage_path: Optional[str] = None,
        reconnect_strategy: Optional[Dict[str, int]] = None,
        heartbeat_options: Optional[Dict[str, Any]] = None,
        session_mac_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        require_signature_verification: Optional[bool] = None,
        max_message_age_ms: int = 60000,
        enable_ecdh_key_exchange: bool = False,
        enable_metadata_encryption: bool = False,
    ) -> None:
        self.url = url
        self.client_id = client_id or self._generate_client_id()
        self.device_fingerprint = device_fingerprint
        self.intent = intent
        self.capabilities = capabilities or ["state-update", "events", "ping-pong"]
        self.metadata = {
            "sdk_version": SDK_VERSION,
            "platform": self._detect_platform(),
            **(metadata or {}),
        }
        self.default_context_tag = default_context_tag
        self.default_affect = default_affect

        self.storage = storage or ThreadStorage(storage_path)
        self.thread_id, self.session_id = self.storage.get_ids(self.client_id)

        self.ws: Optional[WebSocketClientProtocol] = None
        self.is_connected = False
        self.is_handshake_complete = False

        self.heartbeat_interval_ms = 15000
        self.heartbeat_task: Optional[asyncio.Task] = None
        self.receiver_task: Optional[asyncio.Task] = None
        self._pong_event = asyncio.Event()
        self._pong_event.set()

        self.reconnect_attempts = 0
        self.reconnect_task: Optional[asyncio.Task] = None
        self.manual_disconnect = False
        self.last_reconnect_delay_ms = 0
        self.is_attempting_resume = False

        self.reconnect_strategy = {
            "max_retries": (reconnect_strategy or {}).get("max_retries", 5),
            "base_delay_ms": (reconnect_strategy or {}).get("base_delay_ms", 1000),
            "max_delay_ms": (reconnect_strategy or {}).get("max_delay_ms", 30000),
        }
        self.heartbeat_options = {
            "enabled": (heartbeat_options or {}).get("enabled", True),
            "interval_ms": (heartbeat_options or {}).get("interval_ms", 15000),
            "timeout_ms": (heartbeat_options or {}).get("timeout_ms", 45000),
        }

        # Security configuration
        self._mac_key = session_mac_key or secret_key
        self.secret_key = secret_key
        self.require_signature_verification = (
            require_signature_verification
            if require_signature_verification is not None
            else bool(self._mac_key)
        )
        self.max_message_age_ms = max_message_age_ms
        self._seen_nonces: Dict[str, int] = {}
        
        # v0.6.0 Security features
        self.enable_ecdh_key_exchange = enable_ecdh_key_exchange
        self.enable_metadata_encryption = enable_metadata_encryption
        self._ecdh_private_key: Optional[str] = None
        self._ecdh_public_key: Optional[str] = None
        self._session_encryption_key: Optional[str] = None
        self._last_sent_hash: Optional[str] = None
        self._last_received_hash: Optional[str] = None

        self.on_connected: Optional[Callable[[str, str], None]] = None
        self.on_disconnected: Optional[Callable[[], None]] = None
        self.on_error: Optional[Callable[[ErrorPayload], None]] = None
        self.on_state_update: Optional[Callable[[Dict[str, Any]], None]] = None
        self.on_event: Optional[Callable[[Dict[str, Any]], None]] = None
        self.on_pong: Optional[Callable[[], None]] = None
        self.on_message: Optional[Callable[[Dict[str, Any]], None]] = None

        self._handshake_future: Optional[asyncio.Future] = None

    async def connect(self) -> None:
        """Connect to LTP server and perform handshake."""
        self.manual_disconnect = False
        await self._connect_once()

    async def disconnect(self) -> None:
        """Disconnect from LTP server."""
        self.manual_disconnect = True
        if self.heartbeat_task:
            self.heartbeat_task.cancel()
            self.heartbeat_task = None
        if self.receiver_task:
            self.receiver_task.cancel()
            self.receiver_task = None
        if self.ws:
            await self.ws.close()
        self.ws = None
        self.is_connected = False
        self.is_handshake_complete = False

    def _ensure_handshake_keys(self) -> None:
        """Generate ephemeral ECDH keys for the upcoming handshake if missing."""

        if self.enable_ecdh_key_exchange and not self._ecdh_private_key:
            try:
                public_key, private_key = generate_ecdh_key_pair()
                self._ecdh_public_key = public_key
                self._ecdh_private_key = private_key
                # Keep backward compatibility with _handshake_keys
                self._handshake_keys = (public_key, private_key)
            except Exception as e:
                # Log error but continue without ECDH
                print(f"Warning: Failed to generate ECDH key pair: {e}")
        elif not self._handshake_keys:
            # Legacy: generate keys even if ECDH not enabled (for backward compatibility)
            self._handshake_keys = generate_ecdh_key_pair()

    async def send_state_update(self, payload: Dict[str, Any]) -> None:
        """Send state update payload (expects kind/data keys)."""
        await self._send_envelope("state_update", payload)

    async def send_event(self, event_type: str, data: Dict[str, Any]) -> None:
        payload = {
            "event_type": event_type,
            "data": data,
        }
        await self._send_envelope("event", payload)

    async def send_ping(self) -> None:
        await self._send_envelope("ping", {})

    def get_thread_id(self) -> Optional[str]:
        return self.thread_id

    def get_session_id(self) -> Optional[str]:
        return self.session_id

    def is_connected_to_server(self) -> bool:
        return self.is_connected and self.is_handshake_complete

    def get_last_reconnect_delay_ms(self) -> int:
        return self.last_reconnect_delay_ms

    # Internal helpers

    async def _connect_once(self) -> None:
        if websockets is None:
            raise ImportError(
                "websockets library is required. Install with: pip install websockets"
            )

        self.ws = await websockets.connect(self.url, subprotocols=[SUBPROTOCOL])
        self._handshake_future = asyncio.get_running_loop().create_future()
        self.receiver_task = asyncio.create_task(self._message_loop(self.ws))
        await self._send_handshake()
        await self._handshake_future

    async def _send_handshake(self) -> None:
        self._ensure_handshake_keys()
        if self.thread_id:
            self.is_attempting_resume = True
            resume_payload = {
                "type": "handshake_resume",
                "ltp_version": LTP_VERSION,
                "client_id": self.client_id,
                "thread_id": self.thread_id,
                "resume_reason": "automatic_reconnect",
                "client_public_key": self._handshake_keys[0] if self._handshake_keys else None,
                "key_agreement": {
                    "algorithm": "secp256r1",
                    "method": "ecdh",
                    "hkdf": "sha256",
                },
            }
            await self._send_raw(resume_payload)
        else:
            self.is_attempting_resume = False
            await self._send_handshake_init()

    async def _send_handshake_init(self) -> None:
        self._ensure_handshake_keys()
        ecdh_public_key = self._ecdh_public_key or (self._handshake_keys[0] if self._handshake_keys else None)
        
        handshake = HandshakeInit(
            ltp_version=LTP_VERSION,
            client_id=self.client_id,
            device_fingerprint=self.device_fingerprint,
            intent=self.intent,
            capabilities=self.capabilities,
            metadata=self.metadata,
            client_public_key=ecdh_public_key,  # Legacy field
            client_ecdh_public_key=ecdh_public_key if self.enable_ecdh_key_exchange else None,
            key_agreement={
                "algorithm": "secp256r1",
                "method": "ecdh",
                "hkdf": "sha256",
            } if ecdh_public_key else {},
        )
        
        # Sign ECDH public key to prevent MitM attacks (v0.6+)
        if self.enable_ecdh_key_exchange and ecdh_public_key and self.secret_key:
            try:
                timestamp = int(time.time() * 1000)
                handshake.client_ecdh_signature = sign_ecdh_public_key(
                    ecdh_public_key,
                    self.client_id,
                    timestamp,
                    self.secret_key
                )
                handshake.client_ecdh_timestamp = timestamp
            except Exception as e:
                print(f"Warning: Failed to sign ECDH public key: {e}")
        elif self.enable_ecdh_key_exchange and ecdh_public_key and not self.secret_key:
            print("Warning: ECDH key exchange enabled but no secretKey provided - key not authenticated (MitM risk!)")
        
        await self._send_raw(handshake.to_dict())

    async def _message_loop(self, ws: WebSocketClientProtocol) -> None:
        try:
            async for message in ws:
                data = json.loads(message)
                await self._handle_message(data)
        except websockets.exceptions.ConnectionClosed:
            if ws is self.ws:
                await self._handle_disconnect("closed")
        except Exception as error:
            if ws is self.ws:
                print(f"[LTP] Message loop error: {error}")
                await self._handle_disconnect(str(error))

    async def _handle_message(self, data: Dict[str, Any]) -> None:
        if self.on_message:
            self.on_message(data)

        message_type = data.get("type")

        # Decrypt metadata if encrypted (v0.6+)
        if data.get("encrypted_metadata") and self._session_encryption_key:
            try:
                decrypted_metadata = decrypt_metadata(
                    data["encrypted_metadata"],
                    self._session_encryption_key
                )
                # Restore plaintext metadata fields
                data["thread_id"] = decrypted_metadata.get("thread_id", "")
                data["session_id"] = decrypted_metadata.get("session_id", "")
                data["timestamp"] = decrypted_metadata.get("timestamp", 0)
            except Exception as e:
                print(f"[LTP] Failed to decrypt metadata: {e}")
                return  # Reject message if decryption fails

        # Verify hash chain (v0.5+) - detect tampering
        if data.get("prev_message_hash"):
            if self._last_received_hash:
                if data["prev_message_hash"] != self._last_received_hash:
                    print("[LTP] Hash chain mismatch - message tampering detected!")
                    return  # Reject tampered message
            else:
                # First message in chain - accept
                pass
        
        # Update last received hash for next message
        if message_type not in {"handshake_ack", "handshake_reject"}:
            try:
                self._last_received_hash = hash_envelope(data)
            except Exception as e:
                print(f"[LTP] Warning: Failed to compute received message hash: {e}")

        if self.require_signature_verification and self._mac_key and message_type not in {
            "handshake_ack",
            "handshake_reject",
        }:
            if not self._validate_signature(data):
                return
            if not self._validate_timestamp(data):
                return
            if not self._validate_nonce(data):
                return

        if message_type == "handshake_ack":
            await self._handle_handshake_ack(data)
        elif message_type == "handshake_reject":
            await self._handle_handshake_reject(data)
        elif message_type == "pong":
            self._pong_event.set()
            if self.on_pong:
                self.on_pong()
        elif message_type == "state_update" and self.on_state_update:
            self.on_state_update(data.get("payload", {}))
        elif message_type == "event" and self.on_event:
            self.on_event(data.get("payload", {}))
        elif message_type == "error":
            await self._handle_error(data.get("payload", {}))
        else:
            pass

    async def _handle_handshake_ack(self, data: Dict[str, Any]) -> None:
        ack = HandshakeAck.from_dict(data)
        self.thread_id = ack.thread_id
        self.session_id = ack.session_id
        self.heartbeat_interval_ms = ack.heartbeat_interval_ms
        self.storage.set_ids(self.client_id, ack.thread_id, ack.session_id)
        self._last_sent_hash = None
        self._last_received_hash = None

        # ECDH key exchange - derive session keys (v0.5+)
        server_ecdh_key = ack.server_ecdh_public_key or ack.server_public_key
        if self.enable_ecdh_key_exchange and self._ecdh_private_key and server_ecdh_key:
            try:
                # Verify server ECDH key signature (v0.6+) - CRITICAL for MitM protection
                if ack.server_ecdh_signature and ack.server_ecdh_timestamp and self.secret_key:
                    verify_result, error_msg = verify_ecdh_public_key(
                        server_ecdh_key,
                        self.session_id,
                        ack.server_ecdh_timestamp,
                        ack.server_ecdh_signature,
                        self.secret_key
                    )
                    
                    if not verify_result:
                        print(f"[LTP] Server ECDH key signature verification FAILED: {error_msg}")
                        await self._handle_error({
                            "error_code": "ECDH_AUTH_FAILED",
                            "error_message": f"Server ECDH key authentication failed: {error_msg}",
                        })
                        await self.disconnect()
                        return
                    print("[LTP] ✓ Server ECDH key authenticated - MitM protection active")
                elif self.secret_key:
                    print("[LTP] ⚠ Server ECDH key NOT authenticated - MitM attack possible!")
                
                # Derive shared secret
                shared_secret = derive_shared_secret(self._ecdh_private_key, server_ecdh_key)
                
                # Derive session keys
                encryption_key, mac_key, _ = derive_session_keys(shared_secret, self.session_id)
                
                # Set MAC key for signature verification
                self._mac_key = mac_key
                self.require_signature_verification = True
                
                # Set encryption key for metadata encryption (v0.6+)
                self._session_encryption_key = encryption_key
                
                print("[LTP] Session keys derived successfully - signatures now required")
                
                # Clear ephemeral private key for forward secrecy
                self._ecdh_private_key = None
            except Exception as error:
                print(f"[LTP] Failed to derive session keys from ECDH: {error}")
                # Continue without automatic key derivation
        elif self.enable_ecdh_key_exchange and not server_ecdh_key:
            print("[LTP] Warning: ECDH key exchange enabled but server did not provide public key")
        
        # Legacy: backward compatibility with old handshake_keys
        if ack.server_public_key and self._handshake_keys and not self.enable_ecdh_key_exchange:
            try:
                shared_secret = derive_shared_secret(self._handshake_keys[1], ack.server_public_key)
                # Use derive_session_keys for consistency
                _, derived_mac, _ = derive_session_keys(shared_secret, ack.session_id)
                self._mac_key = derived_mac
                self.require_signature_verification = True
            except Exception as error:
                print(f"[LTP] Failed to derive handshake keys: {error}")
            finally:
                self._handshake_keys = None
        else:
            self._handshake_keys = None

        self.is_connected = True
        self.is_handshake_complete = True
        self.reconnect_attempts = 0
        self._pong_event.set()

        if self.heartbeat_options.get("enabled", True):
            if self.heartbeat_task:
                self.heartbeat_task.cancel()
            self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())

        if self.on_connected:
            self.on_connected(ack.thread_id, ack.session_id)

        if self._handshake_future and not self._handshake_future.done():
            self._handshake_future.set_result(True)
            self._handshake_future = None

    async def _handle_handshake_reject(self, data: Dict[str, Any]) -> None:
        reason = data.get("reason", "unknown")
        print(f"[LTP] Handshake rejected: {reason}")
        if self.is_attempting_resume:
            self.storage.clear(self.client_id)
            self.thread_id = None
            self.session_id = None
            self.is_attempting_resume = False
            await self._send_handshake_init()
        else:
            if self._handshake_future and not self._handshake_future.done():
                self._handshake_future.set_exception(ConnectionError(reason))

    async def _handle_error(self, payload: Dict[str, Any]) -> None:
        error = ErrorPayload.from_dict(payload)
        print(f"[LTP] Server error: {error.error_code} - {error.error_message}")
        if self.on_error:
            self.on_error(error)

    async def _handle_disconnect(self, reason: str) -> None:
        self.is_connected = False
        self.is_handshake_complete = False
        if self.heartbeat_task:
            self.heartbeat_task.cancel()
            self.heartbeat_task = None
        self._last_sent_hash = None
        self._last_received_hash = None
        self._handshake_keys = None
        if self.on_disconnected:
            self.on_disconnected()

        if self.manual_disconnect:
            return

        if self.reconnect_attempts >= self.reconnect_strategy["max_retries"]:
            print("[LTP] Permanent failure: reconnect attempts exceeded")
            return

        if not self.reconnect_task or self.reconnect_task.done():
            self.reconnect_task = asyncio.create_task(self._reconnect_after_delay(reason))

    async def _reconnect_after_delay(self, reason: str) -> None:
        delay = min(
            self.reconnect_strategy["base_delay_ms"] * (2 ** self.reconnect_attempts),
            self.reconnect_strategy["max_delay_ms"],
        )
        self.last_reconnect_delay_ms = delay
        self.reconnect_attempts += 1
        print(f"[LTP] Reconnecting in {delay}ms due to {reason}")
        await asyncio.sleep(delay / 1000)
        try:
            await self._connect_once()
        except Exception as error:
            print(f"[LTP] Reconnect attempt failed: {error}")
            await self._handle_disconnect(str(error))

    async def _heartbeat_loop(self) -> None:
        if not self.heartbeat_options.get("enabled", True):
            return
        try:
            while self.is_connected:
                interval = self.heartbeat_options.get("interval_ms", self.heartbeat_interval_ms)
                await asyncio.sleep(interval / 1000)
                if not self.is_connected:
                    break
                await self.send_ping()
                try:
                    await asyncio.wait_for(
                        self._pong_event.wait(),
                        timeout=self.heartbeat_options.get("timeout_ms", 45000) / 1000,
                    )
                    self._pong_event.clear()
                except asyncio.TimeoutError:
                    print("[LTP] Heartbeat timeout")
                    await self._handle_disconnect("heartbeat_timeout")
                    break
        except asyncio.CancelledError:
            pass

    async def _send_envelope(self, message_type: MessageType, payload: Dict[str, Any]) -> None:
        if not self.is_connected or not self.thread_id or not self.session_id:
            print("[LTP] Cannot send message: not connected")
            return

        envelope = self._build_envelope(message_type, payload)
        await self._send(envelope)

    def _build_envelope(self, msg_type: MessageType, payload: Dict[str, Any]) -> Dict[str, Any]:
        meta = LtpMeta(
            client_id=self.client_id,
            context_tag=self.default_context_tag,
            affect=self.default_affect,
        )

        timestamp = self._get_timestamp()
        
        # Build base envelope
        envelope = LtpEnvelope(
            type=msg_type,
            thread_id=self.thread_id or "",
            session_id=self.session_id or "",
            timestamp=timestamp,
            payload=payload,
            meta=meta,
            content_encoding="json",  # Default to JSON; TOON support will be added in future
            nonce=self._generate_nonce(),
        )

        # Add hash chaining (v0.5+) - link to previous message
        if self._last_sent_hash:
            envelope.prev_message_hash = self._last_sent_hash

        message_dict = envelope.to_dict()

        # Metadata encryption (v0.6+) - encrypt thread_id, session_id, timestamp
        if self.enable_metadata_encryption and self._session_encryption_key:
            try:
                metadata_to_encrypt = {
                    "thread_id": self.thread_id or "",
                    "session_id": self.session_id or "",
                    "timestamp": timestamp,
                }
                encrypted_metadata = encrypt_metadata(metadata_to_encrypt, self._session_encryption_key)
                message_dict["encrypted_metadata"] = encrypted_metadata
                
                # Generate routing tag for server-side routing without seeing plaintext
                if self._mac_key:
                    # Ensure mac_key is in hex format (64 hex chars = 32 bytes)
                    mac_key_hex = self._mac_key
                    if not isinstance(mac_key_hex, str) or len(mac_key_hex) != 64:
                        # Convert to hex if needed
                        if isinstance(mac_key_hex, bytes):
                            mac_key_hex = mac_key_hex.hex()
                        else:
                            # Use as-is and let generate_routing_tag handle it
                            mac_key_hex = str(mac_key_hex)
                    
                    routing_tag = generate_routing_tag(
                        self.thread_id or "",
                        self.session_id or "",
                        mac_key_hex
                    )
                    message_dict["routing_tag"] = routing_tag
                
                # Clear plaintext metadata fields when encrypted
                message_dict["thread_id"] = ""
                message_dict["session_id"] = ""
                message_dict["timestamp"] = 0
            except Exception as e:
                print(f"[LTP] Warning: Failed to encrypt metadata: {e}")
                # Continue without encryption

        # Sign message (v0.5+)
        if self._mac_key:
            message_dict["signature"] = sign_message(message_dict, self._mac_key)

        # Compute hash for next message's prev_message_hash (v0.5+ hash chaining)
        try:
            self._last_sent_hash = hash_envelope(message_dict)
        except Exception as e:
            print(f"[LTP] Warning: Failed to compute message hash: {e}")

        return message_dict

    async def _send(self, envelope: Dict[str, Any]) -> None:
        if not self.ws:
            print("[LTP] Cannot send message: WebSocket not initialized")
            return
        await self._send_raw(envelope)

    async def _send_raw(self, message: Dict[str, Any]) -> None:
        if not self.ws:
            return
        await self.ws.send(json.dumps(message))

    def _get_timestamp(self) -> int:
        return int(time.time() * 1000)

    def _validate_signature(self, message: Dict[str, Any]) -> bool:
        required_fields = [
            "type",
            "thread_id",
            "session_id",
            "timestamp",
            "nonce",
            "payload",
            "meta",
            "content_encoding",
            "signature",
        ]
        missing = [field for field in required_fields if field not in message]

        if missing:
            print(f"[LTP] Message missing fields for signature verification: {missing}")
            return False

        signature = message.get("signature")
        if not isinstance(signature, str) or not signature:
            print("[LTP] Invalid or missing signature; rejecting message")
            return False

        if not self._mac_key:
            return False

        if not verify_signature(message, self._mac_key):
            print("[LTP] Signature verification failed; rejecting message")
            return False

        return True

    def _normalize_timestamp_ms(self, raw_timestamp: Any) -> Optional[int]:
        if not isinstance(raw_timestamp, (int, float)):
            return None

        # Support both seconds and milliseconds inputs
        if raw_timestamp > 1_000_000_000_000:
            return int(raw_timestamp)
        return int(raw_timestamp * 1000)

    def _validate_timestamp(self, message: Dict[str, Any]) -> bool:
        ts_ms = self._normalize_timestamp_ms(message.get("timestamp"))
        if ts_ms is None:
            print("[LTP] Missing or invalid timestamp; rejecting message")
            return False

        now_ms = int(time.time() * 1000)
        age_ms = now_ms - ts_ms

        if age_ms > self.max_message_age_ms:
            print(f"[LTP] Message too old ({age_ms}ms); rejecting to prevent replay")
            return False

        if age_ms < -5000:
            print(f"[LTP] Message from the future ({age_ms}ms); rejecting")
            return False

        return True

    def _cleanup_nonces(self) -> None:
        cutoff = int(time.time() * 1000) - (self.max_message_age_ms * 2)
        stale_nonces = [nonce for nonce, ts in self._seen_nonces.items() if ts < cutoff]
        for nonce in stale_nonces:
            del self._seen_nonces[nonce]

    def _validate_nonce(self, message: Dict[str, Any]) -> bool:
        """Validate nonce for replay protection (v0.5+, updated v0.6+).
        
        Supports both HMAC-based nonces (v0.6+) and legacy format.
        """
        nonce = message.get("nonce")
        
        if not isinstance(nonce, str) or not nonce:
            print("[LTP] Missing nonce; rejecting message")
            return False
        
        # Check if nonce has already been seen (replay attack)
        if nonce in self._seen_nonces:
            print("[LTP] Replay detected via nonce; rejecting message")
            return False
        
        timestamp: int
        
        # Check for HMAC-based nonce format (v0.6+): hmac-{32hex}-{timestamp}
        if nonce.startswith("hmac-"):
            parts = nonce.split("-")
            if len(parts) != 3:
                print("[LTP] Invalid HMAC nonce format")
                return False
            
            _, hmac_part, timestamp_part = parts
            
            # Verify HMAC part has correct length (32 hex chars)
            if not hmac_part or len(hmac_part) != 32 or not all(c in "0123456789abcdefABCDEF" for c in hmac_part):
                print("[LTP] Invalid HMAC nonce format (bad HMAC)")
                return False
            
            if not timestamp_part:
                print("[LTP] Invalid HMAC nonce format (missing timestamp)")
                return False
            
            try:
                timestamp = int(timestamp_part)
            except ValueError:
                print("[LTP] Invalid HMAC nonce timestamp")
                return False
        else:
            # Legacy format: clientId-timestamp-randomHex
            parts = nonce.split("-")
            if len(parts) != 3:
                print("[LTP] Invalid nonce format")
                return False
            
            nonce_client_id, nonce_timestamp, random_hex = parts
            
            if not nonce_client_id or not nonce_timestamp or not random_hex:
                print("[LTP] Invalid nonce format (missing parts)")
                return False
            
            # Verify client ID in nonce matches (if available in meta)
            meta = message.get("meta", {})
            client_id = meta.get("client_id") if isinstance(meta, dict) else None
            if client_id and nonce_client_id != client_id:
                print(f"[LTP] Nonce client ID mismatch (expected: {client_id}, got: {nonce_client_id})")
                return False
            
            # Verify timestamp is reasonable
            try:
                timestamp = int(nonce_timestamp)
            except ValueError:
                print("[LTP] Invalid nonce timestamp")
                return False
            
            # Verify random component has sufficient entropy (at least 8 hex chars)
            if len(random_hex) < 8:
                print("[LTP] Insufficient nonce entropy")
                return False
        
        # Common timestamp validation for both formats
        now = int(time.time() * 1000)
        nonce_age = now - timestamp
        
        # Reject if nonce is older than max message age
        if nonce_age > self.max_message_age_ms:
            print(f"[LTP] Nonce too old (age: {nonce_age}ms)")
            return False
        
        # Reject if nonce is from the future (with 5s clock skew tolerance)
        if nonce_age < -5000:
            print("[LTP] Nonce timestamp in future")
            return False
        
        # Add to seen nonces cache
        self._seen_nonces[nonce] = now
        
        return True

    def _generate_client_id(self) -> str:
        return f"client-{uuid4()}"

    def _generate_nonce(self) -> str:
        """Generate cryptographically secure nonce without leaking client identity.
        
        Uses HMAC-based nonce generation (v0.6+) to prevent client ID tracking.
        Falls back to legacy format for backward compatibility.
        """
        timestamp = int(time.time() * 1000)
        random_hex = secrets.token_hex(16)  # Increased entropy
        
        # Get MAC key for HMAC-based nonce
        mac_key = self._mac_key or self.secret_key
        
        if mac_key:
            # HMAC-based nonce (v0.6+) - NO client ID leak
            try:
                input_str = f"{timestamp}-{random_hex}"
                hmac_result = hmac_sha256(input_str, mac_key)
                # Format: hmac-{first 32 chars of HMAC}-{timestamp}
                return f"hmac-{hmac_result[:32]}-{timestamp}"
            except Exception as e:
                print(f"Warning: Failed to generate HMAC nonce, falling back to legacy format: {e}")
        
        # Legacy format (backward compatibility) - contains client ID
        # WARNING: This leaks client identity! Use sessionMacKey to enable secure nonces
        print("Warning: Generating legacy nonce with client ID - use sessionMacKey for privacy")
        return f"{self.client_id}-{timestamp}-{random_hex}"

    def _detect_platform(self) -> str:
        return f"python-{platform.system().lower()}"

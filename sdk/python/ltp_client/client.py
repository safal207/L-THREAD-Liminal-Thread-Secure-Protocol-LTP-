"""
LTP (Liminal Thread Protocol) Python Client
Version 0.2
"""

import asyncio
import json
import os
import platform
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

LTP_VERSION = "0.2"
SDK_VERSION = "0.2.0"
SUBPROTOCOL = "ltp.v0.2"


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
    ) -> None:
        if websockets is None:
            raise ImportError(
                "websockets library is required. Install with: pip install websockets"
            )

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
        self.ws = await websockets.connect(self.url, subprotocols=[SUBPROTOCOL])
        self._handshake_future = asyncio.get_running_loop().create_future()
        self.receiver_task = asyncio.create_task(self._message_loop(self.ws))
        await self._send_handshake()
        await self._handshake_future

    async def _send_handshake(self) -> None:
        if self.thread_id:
            self.is_attempting_resume = True
            resume_payload = {
                "type": "handshake_resume",
                "ltp_version": LTP_VERSION,
                "client_id": self.client_id,
                "thread_id": self.thread_id,
                "resume_reason": "automatic_reconnect",
            }
            await self._send_raw(resume_payload)
        else:
            self.is_attempting_resume = False
            await self._send_handshake_init()

    async def _send_handshake_init(self) -> None:
        handshake = HandshakeInit(
            ltp_version=LTP_VERSION,
            client_id=self.client_id,
            device_fingerprint=self.device_fingerprint,
            intent=self.intent,
            capabilities=self.capabilities,
            metadata=self.metadata,
        )
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

        meta = LtpMeta(
            client_id=self.client_id,
            context_tag=self.default_context_tag,
            affect=self.default_affect,
        )

        envelope = LtpEnvelope(
            type=message_type,
            thread_id=self.thread_id,
            session_id=self.session_id,
            timestamp=self._get_timestamp(),
            payload=payload,
            meta=meta,
            content_encoding="json",  # Default to JSON; TOON support will be added in future
            nonce=self._generate_nonce(),
            signature="v0-placeholder",
        )
        await self._send(envelope)

    async def _send(self, envelope: LtpEnvelope) -> None:
        if not self.ws:
            print("[LTP] Cannot send message: WebSocket not initialized")
            return
        await self._send_raw(envelope.to_dict())

    async def _send_raw(self, message: Dict[str, Any]) -> None:
        if not self.ws:
            return
        await self.ws.send(json.dumps(message))

    def _get_timestamp(self) -> int:
        return int(time.time())

    def _generate_client_id(self) -> str:
        return f"client-{uuid4()}"

    def _generate_nonce(self) -> str:
        return f"{self.client_id}-{int(time.time() * 1000)}-{uuid4().hex[:6]}"

    def _detect_platform(self) -> str:
        return f"python-{platform.system().lower()}"

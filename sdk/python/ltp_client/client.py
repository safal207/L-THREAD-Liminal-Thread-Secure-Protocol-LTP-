"""
LTP (Liminal Thread Protocol) Python Client
Version 0.1
"""

import asyncio
import json
import time
import platform
from typing import Any, Callable, Dict, List, Optional
from uuid import uuid4

try:
    import websockets
    from websockets.client import WebSocketClientProtocol
except ImportError:
    websockets = None
    WebSocketClientProtocol = Any

from .types import (
    HandshakeInit,
    HandshakeAck,
    LtpEnvelope,
    LtpMeta,
    StateUpdatePayload,
    EventPayload,
    ErrorPayload,
    MessageType,
)

LTP_VERSION = "0.1"
SDK_VERSION = "0.1.0"


class LtpClient:
    """
    LTP Client for establishing and managing liminal thread sessions
    """

    def __init__(
        self,
        url: str,
        client_id: Optional[str] = None,
        device_fingerprint: Optional[str] = None,
        intent: str = "resonant_link",
        capabilities: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """
        Create a new LTP client

        Args:
            url: WebSocket URL (ws:// or wss://)
            client_id: Unique client identifier (auto-generated if not provided)
            device_fingerprint: Device identification
            intent: Declared intent for the connection
            capabilities: Client capabilities
            metadata: Additional client metadata
        """
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

        self.ws: Optional[WebSocketClientProtocol] = None
        self.thread_id: Optional[str] = None
        self.session_id: Optional[str] = None
        self.heartbeat_interval_ms: int = 15000
        self.heartbeat_task: Optional[asyncio.Task] = None

        self.is_connected: bool = False
        self.is_handshake_complete: bool = False

        # Event handlers
        self.on_connected: Optional[Callable[[str, str], None]] = None
        self.on_disconnected: Optional[Callable[[], None]] = None
        self.on_error: Optional[Callable[[ErrorPayload], None]] = None
        self.on_state_update: Optional[Callable[[Dict[str, Any]], None]] = None
        self.on_event: Optional[Callable[[Dict[str, Any]], None]] = None
        self.on_pong: Optional[Callable[[], None]] = None
        self.on_message: Optional[Callable[[Dict[str, Any]], None]] = None

    async def connect(self) -> None:
        """Connect to LTP server and perform handshake"""
        try:
            self.ws = await websockets.connect(
                self.url,
                subprotocols=["ltp.v0.1"]
            )

            print("[LTP] WebSocket connected, initiating handshake...")
            await self._send_handshake_init()

            # Wait for handshake acknowledgment
            async for message in self.ws:
                data = json.loads(message)
                await self._handle_message(data)

                if self.is_handshake_complete:
                    # Start heartbeat and message loop
                    self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())
                    asyncio.create_task(self._message_loop())
                    break

        except Exception as error:
            print(f"[LTP] Connection error: {error}")
            raise

    async def disconnect(self) -> None:
        """Disconnect from LTP server"""
        if self.heartbeat_task:
            self.heartbeat_task.cancel()
            try:
                await self.heartbeat_task
            except asyncio.CancelledError:
                pass

        if self.ws:
            await self.ws.close()
            self.ws = None

        self.is_connected = False
        self.is_handshake_complete = False

    async def send_state_update(self, payload: Dict[str, Any]) -> None:
        """
        Send state update message

        Args:
            payload: State update payload with 'kind' and 'data' fields
        """
        envelope = LtpEnvelope(
            type="state_update",
            thread_id=self.thread_id or "",
            session_id=self.session_id or "",
            timestamp=self._get_timestamp(),
            payload=payload,
            meta=LtpMeta(client_id=self.client_id),
        )
        await self._send(envelope)

    async def send_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """
        Send event message

        Args:
            event_type: Event type identifier
            data: Event data
        """
        payload = {
            "event_type": event_type,
            "data": data,
        }

        envelope = LtpEnvelope(
            type="event",
            thread_id=self.thread_id or "",
            session_id=self.session_id or "",
            timestamp=self._get_timestamp(),
            payload=payload,
            meta=LtpMeta(client_id=self.client_id),
        )
        await self._send(envelope)

    async def send_ping(self) -> None:
        """Send ping message (usually handled automatically by heartbeat)"""
        envelope = LtpEnvelope(
            type="ping",
            thread_id=self.thread_id or "",
            session_id=self.session_id or "",
            timestamp=self._get_timestamp(),
            payload={},
            meta=LtpMeta(client_id=self.client_id),
        )
        await self._send(envelope)

    def get_thread_id(self) -> Optional[str]:
        """Get current thread ID"""
        return self.thread_id

    def get_session_id(self) -> Optional[str]:
        """Get current session ID"""
        return self.session_id

    def is_connected_to_server(self) -> bool:
        """Check if client is connected"""
        return self.is_connected and self.is_handshake_complete

    # Private methods

    async def _send_handshake_init(self) -> None:
        """Send handshake init message"""
        handshake = HandshakeInit(
            ltp_version=LTP_VERSION,
            client_id=self.client_id,
            device_fingerprint=self.device_fingerprint,
            intent=self.intent,
            capabilities=self.capabilities,
            metadata=self.metadata,
        )
        await self._send_raw(handshake.to_dict())

    async def _handle_message(self, data: Dict[str, Any]) -> None:
        """Handle incoming message"""
        # Call generic message handler
        if self.on_message:
            self.on_message(data)

        message_type = data.get("type")

        if message_type == "handshake_ack":
            await self._handle_handshake_ack(data)
        elif message_type == "pong":
            if self.on_pong:
                self.on_pong()
        elif message_type == "state_update":
            if self.on_state_update:
                self.on_state_update(data.get("payload", {}))
        elif message_type == "event":
            if self.on_event:
                self.on_event(data.get("payload", {}))
        elif message_type == "error":
            await self._handle_error(data.get("payload", {}))
        else:
            print(f"[LTP] Received message: {message_type}")

    async def _handle_handshake_ack(self, data: Dict[str, Any]) -> None:
        """Handle handshake acknowledgment"""
        print("[LTP] Handshake acknowledged")

        ack = HandshakeAck.from_dict(data)
        self.thread_id = ack.thread_id
        self.session_id = ack.session_id
        self.heartbeat_interval_ms = ack.heartbeat_interval_ms
        self.is_connected = True
        self.is_handshake_complete = True

        if self.on_connected:
            self.on_connected(self.thread_id, self.session_id)

    async def _handle_error(self, payload: Dict[str, Any]) -> None:
        """Handle error message"""
        error = ErrorPayload.from_dict(payload)
        print(f"[LTP] Server error: {error.error_code} - {error.error_message}")

        if self.on_error:
            self.on_error(error)

    async def _message_loop(self) -> None:
        """Main message receiving loop"""
        try:
            if self.ws:
                async for message in self.ws:
                    data = json.loads(message)
                    await self._handle_message(data)
        except websockets.exceptions.ConnectionClosed:
            print("[LTP] Connection closed")
            await self._handle_disconnect()
        except Exception as error:
            print(f"[LTP] Message loop error: {error}")

    async def _heartbeat_loop(self) -> None:
        """Heartbeat loop for sending periodic pings"""
        try:
            while self.is_connected:
                await asyncio.sleep(self.heartbeat_interval_ms / 1000)
                if self.is_connected:
                    await self.send_ping()
        except asyncio.CancelledError:
            pass

    async def _handle_disconnect(self) -> None:
        """Handle disconnection"""
        self.is_connected = False
        self.is_handshake_complete = False

        if self.heartbeat_task:
            self.heartbeat_task.cancel()

        if self.on_disconnected:
            self.on_disconnected()

    async def _send(self, envelope: LtpEnvelope) -> None:
        """Send LTP envelope message"""
        if not self.is_connected or not self.is_handshake_complete:
            print("[LTP] Cannot send message: not connected")
            return

        await self._send_raw(envelope.to_dict())

    async def _send_raw(self, message: Dict[str, Any]) -> None:
        """Send raw message"""
        if not self.ws:
            print("[LTP] Cannot send message: WebSocket not initialized")
            return

        json_str = json.dumps(message)
        await self.ws.send(json_str)

    def _get_timestamp(self) -> int:
        """Get current Unix timestamp in seconds"""
        return int(time.time())

    def _generate_client_id(self) -> str:
        """Generate a unique client ID"""
        return f"client-{uuid4()}"

    def _detect_platform(self) -> str:
        """Detect the current platform"""
        return f"python-{platform.system().lower()}"

"""
LTP (Liminal Thread Protocol) Python Types
Version 0.3
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional, Union

# Message types
MessageType = Literal[
    "handshake_init",
    "handshake_resume",
    "handshake_ack",
    "handshake_reject",
    "ping",
    "pong",
    "state_update",
    "event",
    "error",
]

StateUpdateKind = Literal["minimal", "full", "delta"]


@dataclass
class LtpMeta:
    """Metadata for LTP messages"""
    client_id: Optional[str] = None
    trace_id: Optional[str] = None
    parent_span_id: Optional[str] = None
    user_agent: Optional[str] = None
    context_tag: Optional[str] = None
    affect: Optional[Dict[str, float]] = None
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary, excluding None values"""
        result = {}
        if self.client_id:
            result['client_id'] = self.client_id
        if self.trace_id:
            result['trace_id'] = self.trace_id
        if self.parent_span_id:
            result['parent_span_id'] = self.parent_span_id
        if self.user_agent:
            result['user_agent'] = self.user_agent
        if self.context_tag:
            result['context_tag'] = self.context_tag
        if self.affect:
            result['affect'] = self.affect
        result.update(self.extra)
        return result


@dataclass
class HandshakeInit:
    """Handshake Init Message (Client → Server)"""
    type: Literal["handshake_init"] = "handshake_init"
    ltp_version: str = "0.3"
    client_id: str = ""
    device_fingerprint: Optional[str] = None
    intent: Optional[str] = None
    capabilities: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    client_public_key: Optional[str] = None
    key_agreement: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        result: Dict[str, Any] = {
            'type': self.type,
            'ltp_version': self.ltp_version,
            'client_id': self.client_id,
        }
        if self.device_fingerprint:
            result['device_fingerprint'] = self.device_fingerprint
        if self.intent:
            result['intent'] = self.intent
        if self.capabilities:
            result['capabilities'] = self.capabilities
        if self.metadata:
            result['metadata'] = self.metadata
        if self.client_public_key:
            result['client_public_key'] = self.client_public_key
        if self.key_agreement:
            result['key_agreement'] = self.key_agreement
        return result


@dataclass
class HandshakeAck:
    """Handshake Acknowledgment Message (Server → Client)"""
    type: Literal["handshake_ack"] = "handshake_ack"
    ltp_version: str = "0.3"
    thread_id: str = ""
    session_id: str = ""
    server_capabilities: List[str] = field(default_factory=list)
    heartbeat_interval_ms: int = 15000
    metadata: Dict[str, Any] = field(default_factory=dict)
    server_public_key: Optional[str] = None
    key_agreement: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'HandshakeAck':
        """Create from dictionary"""
        return cls(
            type=data.get('type', 'handshake_ack'),
            ltp_version=data.get('ltp_version', '0.1'),
            thread_id=data.get('thread_id', ''),
            session_id=data.get('session_id', ''),
            server_capabilities=data.get('server_capabilities', []),
            heartbeat_interval_ms=data.get('heartbeat_interval_ms', 15000),
            metadata=data.get('metadata', {}),
            server_public_key=data.get('server_public_key'),
            key_agreement=data.get('key_agreement', {}),
        )


@dataclass
class LtpEnvelope:
    """Base envelope for all LTP messages (except handshake)"""
    type: MessageType
    thread_id: str
    session_id: str
    timestamp: int
    payload: Dict[str, Any] = field(default_factory=dict)
    meta: Optional[LtpMeta] = None
    content_encoding: Optional[str] = None  # "json" (default) or "toon" (v0.3+)
    nonce: Optional[str] = None
    signature: Optional[str] = None
    prev_message_hash: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        result: Dict[str, Any] = {
            'type': self.type,
            'thread_id': self.thread_id,
            'session_id': self.session_id,
            'timestamp': self.timestamp,
            'payload': self.payload,
        }
        if self.meta:
            result['meta'] = self.meta.to_dict()
        if self.content_encoding and self.content_encoding != 'json':
            result['content_encoding'] = self.content_encoding
        if self.nonce:
            result['nonce'] = self.nonce
        if self.signature:
            result['signature'] = self.signature
        if self.prev_message_hash:
            result['prev_message_hash'] = self.prev_message_hash
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'LtpEnvelope':
        """Create from dictionary"""
        meta_data = data.get('meta')
        meta = LtpMeta(**meta_data) if meta_data else None

        return cls(
            type=data['type'],
            thread_id=data['thread_id'],
            session_id=data['session_id'],
            timestamp=data['timestamp'],
            payload=data.get('payload', {}),
            meta=meta,
            content_encoding=data.get('content_encoding'),  # v0.3+: TOON support
            nonce=data.get('nonce'),
            signature=data.get('signature')
        )


@dataclass
class StateUpdatePayload:
    """State Update Message Payload"""
    kind: StateUpdateKind
    data: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'kind': self.kind,
            'data': self.data
        }


@dataclass
class EventPayload:
    """Event Message Payload"""
    event_type: str
    data: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'event_type': self.event_type,
            'data': self.data
        }


@dataclass
class ErrorPayload:
    """Error Message Payload"""
    error_code: str
    error_message: str
    details: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ErrorPayload':
        """Create from dictionary"""
        return cls(
            error_code=data['error_code'],
            error_message=data['error_message'],
            details=data.get('details', {})
        )


# Union type for all LTP messages
LtpMessage = Union[HandshakeInit, HandshakeAck, LtpEnvelope]

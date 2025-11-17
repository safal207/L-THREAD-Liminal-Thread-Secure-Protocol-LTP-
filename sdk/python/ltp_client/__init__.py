"""
LTP (Liminal Thread Protocol) Python SDK
Version 0.3

Entry point for the LTP client library
"""

from .client import LtpClient
from .types import (
    HandshakeInit,
    HandshakeAck,
    LtpEnvelope,
    LtpMeta,
    StateUpdatePayload,
    EventPayload,
    ErrorPayload,
    MessageType,
    StateUpdateKind,
    LtpMessage,
)

__version__ = "0.3.0"
__all__ = [
    "LtpClient",
    "HandshakeInit",
    "HandshakeAck",
    "LtpEnvelope",
    "LtpMeta",
    "StateUpdatePayload",
    "EventPayload",
    "ErrorPayload",
    "MessageType",
    "StateUpdateKind",
    "LtpMessage",
]

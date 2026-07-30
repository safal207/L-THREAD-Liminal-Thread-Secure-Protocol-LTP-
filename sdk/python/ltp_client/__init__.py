"""
LTP (Liminal Thread Protocol) Python SDK
Version 0.6

Entry point for the LTP client library.
"""

from . import client as _client_module
from .secure_client import SecureLtpClient
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

# Keep both supported import paths on the hardened implementation:
#   from ltp_client import LtpClient
#   from ltp_client.client import LtpClient
# Importing a submodule executes this package initializer first, so replacing the
# module attribute also closes the direct-import path without duplicating clients.
_client_module.LtpClient = SecureLtpClient
LtpClient = SecureLtpClient

__version__ = "0.6.0-alpha.3"
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

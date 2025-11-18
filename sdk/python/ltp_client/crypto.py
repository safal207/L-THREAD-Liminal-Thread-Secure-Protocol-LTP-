"""Cryptographic helpers for the LTP Python client."""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any, Dict


def _canonical_message(message: Dict[str, Any]) -> Dict[str, Any]:
    """Extract the canonical fields used for signing/verification."""

    return {
        "type": message.get("type", ""),
        "thread_id": message.get("thread_id", ""),
        "session_id": message.get("session_id", ""),
        "timestamp": message.get("timestamp", 0),
        "nonce": message.get("nonce", ""),
        "payload": message.get("payload", {}),
        "meta": message.get("meta", {}),
        "content_encoding": message.get("content_encoding", ""),
    }


def _serialize_canonical(message: Dict[str, Any]) -> str:
    """Serialize canonical message deterministically for HMAC signing."""

    canonical = _canonical_message(message)
    return json.dumps(
        canonical,
        separators=(",", ":"),
        ensure_ascii=False,
        sort_keys=True,
    )


def sign_message(message: Dict[str, Any], secret_key: str) -> str:
    """Generate an HMAC-SHA256 signature for the given message."""

    serialized = _serialize_canonical(message)
    mac = hmac.new(secret_key.encode("utf-8"), serialized.encode("utf-8"), hashlib.sha256)
    return mac.hexdigest()


def verify_signature(message: Dict[str, Any], secret_key: str) -> bool:
    """Verify the HMAC-SHA256 signature for a message using constant-time comparison."""

    provided_signature = message.get("signature", "")
    if not isinstance(provided_signature, str):
        return False

    expected_signature = sign_message(message, secret_key)
    return hmac.compare_digest(expected_signature, provided_signature)


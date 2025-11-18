"""Cryptographic helpers for the LTP Python client."""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any, Dict, Tuple

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


def _canonical_message(message: Dict[str, Any]) -> Dict[str, Any]:
    """Extract the canonical fields used for signing/verification."""

    return {
        "type": message.get("type", ""),
        "thread_id": message.get("thread_id", ""),
        "session_id": message.get("session_id", ""),
        "timestamp": message.get("timestamp", 0),
        "nonce": message.get("nonce", ""),
        "payload": message.get("payload", {}),
        "prev_message_hash": message.get("prev_message_hash", ""),
    }


def _serialize_canonical(message: Dict[str, Any]) -> str:
    """Serialize canonical message deterministically for HMAC signing and hashing."""

    canonical = _canonical_message(message)
    return json.dumps(canonical, separators=(",", ":"), ensure_ascii=False, sort_keys=True)


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


def hash_envelope(message: Dict[str, Any]) -> str:
    """Produce a deterministic SHA-256 hash over canonical envelope fields."""

    serialized = _serialize_canonical(message)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def generate_ecdh_key_pair() -> Tuple[str, str]:
    """Generate an ephemeral ECDH key pair (secp256r1) returned as hex strings."""

    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    public_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    private_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )

    return public_bytes.hex(), private_bytes.hex()


def derive_shared_secret(private_key_hex: str, peer_public_key_hex: str) -> str:
    """Derive the ECDH shared secret from a local private key and peer public key."""

    private_key = serialization.load_der_private_key(bytes.fromhex(private_key_hex), password=None)
    public_key = ec.EllipticCurvePublicKey.from_encoded_point(
        ec.SECP256R1(), bytes.fromhex(peer_public_key_hex)
    )

    shared_secret = private_key.exchange(ec.ECDH(), public_key)
    return shared_secret.hex()


def hkdf(shared_secret_hex: str, salt: str, info: str, length: int = 32) -> str:
    """HKDF-SHA256 derivation matching the JavaScript client output."""

    shared_secret_bytes = bytes.fromhex(shared_secret_hex)
    hkdf_inst = HKDF(
        algorithm=hashes.SHA256(),
        length=length,
        salt=salt.encode("utf-8"),
        info=info.encode("utf-8"),
    )
    derived = hkdf_inst.derive(shared_secret_bytes)
    return derived.hex()

"""Cryptographic helpers for the LTP Python client."""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
from typing import Any, Dict, Tuple, Optional

try:
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.backends import default_backend
    CRYPTOGRAPHY_AVAILABLE = True
except ImportError:
    CRYPTOGRAPHY_AVAILABLE = False


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


# ============================================================================
# v0.6.0 Security Features
# ============================================================================


def hmac_sha256(input_str: str, key: str) -> str:
    """Compute HMAC-SHA256 for any string input.
    
    Used for secure nonce generation and other HMAC operations.
    """
    mac = hmac.new(key.encode("utf-8"), input_str.encode("utf-8"), hashlib.sha256)
    return mac.hexdigest()


def generate_ecdh_key_pair() -> Tuple[str, str]:
    """Generate ECDH key pair for key exchange.
    
    Returns:
        Tuple of (public_key_hex, private_key_hex) using secp256r1 (P-256) curve.
    """
    if not CRYPTOGRAPHY_AVAILABLE:
        raise ImportError(
            "cryptography library is required for ECDH. Install with: pip install cryptography"
        )
    
    # Generate private key
    private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
    
    # Get public key
    public_key = private_key.public_key()
    
    # Serialize keys to hex
    private_key_bytes = private_key.private_numbers().private_value.to_bytes(32, "big")
    public_key_bytes = public_key.public_bytes(
        encoding=ec.encoding.Encoding.X962,
        format=ec.encoding.PublicFormat.UncompressedPoint
    )
    
    return public_key_bytes.hex(), private_key_bytes.hex()


def derive_shared_secret(private_key_hex: str, peer_public_key_hex: str) -> str:
    """Derive shared secret from ECDH key exchange.
    
    Args:
        private_key_hex: Hex-encoded private key
        peer_public_key_hex: Hex-encoded peer public key (uncompressed point)
    
    Returns:
        Hex-encoded shared secret (32 bytes)
    """
    if not CRYPTOGRAPHY_AVAILABLE:
        raise ImportError(
            "cryptography library is required for ECDH. Install with: pip install cryptography"
        )
    
    # Load private key
    private_key_int = int(private_key_hex, 16)
    private_key = ec.derive_private_key(private_key_int, ec.SECP256R1(), default_backend())
    
    # Load peer public key (uncompressed point format)
    peer_public_key_bytes = bytes.fromhex(peer_public_key_hex)
    peer_public_key = ec.EllipticCurvePublicKey.from_encoded_point(
        ec.SECP256R1(), peer_public_key_bytes
    )
    
    # Derive shared secret
    shared_secret = private_key.exchange(ec.ECDH(), peer_public_key)
    
    return shared_secret.hex()


def hkdf(shared_secret_hex: str, salt: str, info: str, key_length: int = 32) -> str:
    """HKDF (HMAC-based Key Derivation Function) - RFC 5869.
    
    Derives multiple keys from shared secret with proper key separation.
    
    Args:
        shared_secret_hex: Hex-encoded shared secret
        salt: Salt string
        info: Info string for key separation
        key_length: Desired key length in bytes (default: 32)
    
    Returns:
        Hex-encoded derived key
    """
    if not CRYPTOGRAPHY_AVAILABLE:
        raise ImportError(
            "cryptography library is required for HKDF. Install with: pip install cryptography"
        )
    
    shared_secret = bytes.fromhex(shared_secret_hex)
    salt_bytes = salt.encode("utf-8") if salt else b"\x00" * 32
    info_bytes = info.encode("utf-8")
    
    hkdf_instance = HKDF(
        algorithm=hashes.SHA256(),
        length=key_length,
        salt=salt_bytes,
        info=info_bytes,
        backend=default_backend(),
    )
    
    derived_key = hkdf_instance.derive(shared_secret)
    return derived_key.hex()


def derive_session_keys(
    shared_secret_hex: str, session_id: str
) -> Tuple[str, str, str]:
    """Derive session keys from ECDH shared secret using HKDF.
    
    Returns separate keys for encryption, MAC, and IV.
    
    Args:
        shared_secret_hex: Hex-encoded shared secret from ECDH
        session_id: Session identifier for key separation
    
    Returns:
        Tuple of (encryption_key_hex, mac_key_hex, iv_key_hex)
    """
    salt = f"ltp-v0.5-{session_id}"
    
    encryption_key = hkdf(shared_secret_hex, salt, "ltp-encryption-key", 32)
    mac_key = hkdf(shared_secret_hex, salt, "ltp-mac-key", 32)
    iv_key = hkdf(shared_secret_hex, salt, "ltp-iv-key", 16)
    
    return encryption_key, mac_key, iv_key


def sign_ecdh_public_key(
    public_key: str, entity_id: str, timestamp: int, secret_key: str
) -> str:
    """Sign an ECDH public key to prevent MitM attacks (v0.6+).
    
    Creates HMAC signature over: publicKey + entityId + timestamp
    This authenticates the ephemeral ECDH key exchange.
    
    Args:
        public_key: Hex-encoded ECDH public key
        entity_id: client_id (for client) or session_id (for server)
        timestamp: Unix timestamp in milliseconds
        secret_key: Long-term secret key for signing
    
    Returns:
        Hex-encoded HMAC-SHA256 signature
    """
    input_str = f"{public_key}:{entity_id}:{timestamp}"
    return hmac_sha256(input_str, secret_key)


def verify_ecdh_public_key(
    public_key: str,
    entity_id: str,
    timestamp: int,
    signature: str,
    secret_key: str,
    max_age_ms: int = 300000,
) -> Tuple[bool, Optional[str]]:
    """Verify ECDH public key signature (v0.6+).
    
    Validates that the ephemeral ECDH public key was signed by the expected party.
    Prevents MitM attacks on key exchange.
    
    Args:
        public_key: Hex-encoded ECDH public key
        entity_id: client_id (for client) or session_id (for server)
        timestamp: Unix timestamp in milliseconds
        signature: Hex-encoded HMAC-SHA256 signature to verify
        secret_key: Long-term secret key for verification
        max_age_ms: Maximum age of signature in milliseconds (default: 300000 = 5 minutes)
    
    Returns:
        Tuple of (is_valid: bool, error_message: str | None)
    """
    # Check timestamp freshness
    now = int(time.time() * 1000)
    age = now - timestamp
    
    if age > max_age_ms:
        return False, f"ECDH key signature expired (age: {age}ms, max: {max_age_ms}ms)"
    
    if age < -5000:
        return False, f"ECDH key signature from future (skew: {-age}ms)"
    
    # Compute expected signature
    input_str = f"{public_key}:{entity_id}:{timestamp}"
    expected_signature = hmac_sha256(input_str, secret_key)
    
    # Constant-time comparison
    if not hmac.compare_digest(signature, expected_signature):
        return False, "ECDH key signature mismatch"
    
    return True, None


def hash_envelope(message: Dict[str, Any]) -> str:
    """Generate a deterministic SHA-256 hash commitment for a canonical envelope.
    
    Args:
        message: Message envelope with type, thread_id, session_id, timestamp, nonce, payload, prev_message_hash
    
    Returns:
        Hex-encoded SHA-256 hash
    """
    canonical = _canonical_message(message)
    serialized = _serialize_canonical({"type": message.get("type", ""), **canonical})
    
    hash_obj = hashlib.sha256(serialized.encode("utf-8"))
    return hash_obj.hexdigest()


def encrypt_metadata(
    metadata: Dict[str, Any], encryption_key_hex: str
) -> str:
    """Encrypt sensitive metadata fields to prevent tracking (v0.6+).
    
    Encrypts thread_id, session_id, and timestamp using AES-256-GCM.
    This prevents adversaries from tracking users across sessions.
    
    Args:
        metadata: Metadata object containing thread_id, session_id, timestamp
        encryption_key_hex: Hex-encoded 256-bit encryption key (from HKDF)
    
    Returns:
        Encrypted metadata blob (ciphertext:iv:tag format)
    """
    if not CRYPTOGRAPHY_AVAILABLE:
        raise ImportError(
            "cryptography library is required for encryption. Install with: pip install cryptography"
        )
    
    # Serialize metadata to JSON
    metadata_json = json.dumps(metadata, separators=(",", ":"))
    
    # Encrypt using AES-256-GCM
    encryption_key = bytes.fromhex(encryption_key_hex)
    aesgcm = AESGCM(encryption_key)
    
    # Generate random IV (12 bytes for GCM)
    iv = secrets.token_bytes(12)
    
    # Encrypt
    ciphertext = aesgcm.encrypt(iv, metadata_json.encode("utf-8"), None)
    
    # Format: ciphertext:iv:tag (colon-separated for easy parsing)
    # GCM includes auth tag at the end of ciphertext
    tag = ciphertext[-16:]
    ciphertext_only = ciphertext[:-16]
    
    return f"{ciphertext_only.hex()}:{iv.hex()}:{tag.hex()}"


def decrypt_metadata(
    encrypted_metadata: str, encryption_key_hex: str
) -> Dict[str, Any]:
    """Decrypt metadata fields (v0.6+).
    
    Args:
        encrypted_metadata: Encrypted metadata blob (ciphertext:iv:tag format)
        encryption_key_hex: Hex-encoded 256-bit encryption key
    
    Returns:
        Decrypted metadata object
    """
    if not CRYPTOGRAPHY_AVAILABLE:
        raise ImportError(
            "cryptography library is required for decryption. Install with: pip install cryptography"
        )
    
    # Parse format: ciphertext:iv:tag
    parts = encrypted_metadata.split(":")
    if len(parts) != 3:
        raise ValueError("Invalid encrypted metadata format - expected ciphertext:iv:tag")
    
    ciphertext_hex, iv_hex, tag_hex = parts
    
    if not ciphertext_hex or not iv_hex or not tag_hex:
        raise ValueError("Invalid encrypted metadata format - missing parts")
    
    # Decrypt using AES-256-GCM
    encryption_key = bytes.fromhex(encryption_key_hex)
    aesgcm = AESGCM(encryption_key)
    
    iv = bytes.fromhex(iv_hex)
    ciphertext = bytes.fromhex(ciphertext_hex) + bytes.fromhex(tag_hex)
    
    # Decrypt
    decrypted_bytes = aesgcm.decrypt(iv, ciphertext, None)
    decrypted_json = decrypted_bytes.decode("utf-8")
    
    # Parse JSON back to metadata object
    metadata = json.loads(decrypted_json)
    
    if not metadata.get("thread_id") or not metadata.get("session_id") or not isinstance(metadata.get("timestamp"), (int, float)):
        raise ValueError("Invalid decrypted metadata structure")
    
    return metadata


def generate_routing_tag(thread_id: str, session_id: str, mac_key_hex: str) -> str:
    """Generate routing tag for server-side message routing (v0.6+).
    
    Creates HMAC-based tag that doesn't reveal thread_id or session_id.
    Server can use this for routing without seeing plaintext metadata.
    
    Args:
        thread_id: Thread identifier
        session_id: Session identifier
        mac_key_hex: Hex-encoded MAC key (from HKDF)
    
    Returns:
        Routing tag (first 32 hex characters of HMAC)
    """
    input_str = f"{thread_id}:{session_id}"
    # Convert hex key to bytes, then use as key for HMAC
    mac_key_bytes = bytes.fromhex(mac_key_hex)
    mac = hmac.new(mac_key_bytes, input_str.encode("utf-8"), hashlib.sha256)
    hmac_result = mac.hexdigest()
    # Return first 32 hex characters (16 bytes) for routing tag
    return hmac_result[:32]


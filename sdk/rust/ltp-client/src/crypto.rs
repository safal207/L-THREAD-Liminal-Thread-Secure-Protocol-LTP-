//! Cryptographic helpers for the LTP Rust client.
//!
//! Provides ECDH key exchange, authenticated ECDH, HMAC-based nonces,
//! metadata encryption, and hash chaining functions for v0.6.0 security features.

use hmac::{Hmac, Mac};
use p256::{
    ecdh::EphemeralSecret,
    PublicKey, SecretKey, EncodedPoint,
};
use p256::elliptic_curve::sec1::{FromEncodedPoint, ToEncodedPoint};
use sha2::{Digest, Sha256};
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use hkdf::Hkdf;
use hex;
use serde_json::Value;

pub type HmacSha256 = Hmac<Sha256>;

/// Compute HMAC-SHA256 for any string input.
///
/// Used for secure nonce generation and other HMAC operations.
pub fn hmac_sha256(input: &str, key: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(key.as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(input.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

/// Generate ECDH key pair for key exchange.
///
/// Returns tuple of (public_key_hex, private_key_hex) using secp256r1 (P-256) curve.
pub fn generate_ecdh_key_pair() -> (String, String) {
    let secret = EphemeralSecret::random(&mut OsRng);
    let public = PublicKey::from(&secret);
    
    // Serialize keys to hex
    // Public key: uncompressed SEC1 format (0x04 || x || y)
    let public_key_bytes = public.to_encoded_point(false).as_bytes();
    // Private key: 32 bytes
    let private_key_bytes = secret.to_bytes();
    
    (
        hex::encode(public_key_bytes),
        hex::encode(private_key_bytes.as_slice()),
    )
}

/// Derive shared secret from ECDH key exchange.
///
/// Args:
/// - private_key_hex: Hex-encoded private key
/// - peer_public_key_hex: Hex-encoded peer public key (uncompressed point)
///
/// Returns:
/// Hex-encoded shared secret (32 bytes)
pub fn derive_shared_secret(
    private_key_hex: &str,
    peer_public_key_hex: &str,
) -> Result<String, String> {
    use p256::elliptic_curve::sec1::FromEncodedPoint;
    
    // Decode private key
    let private_key_bytes = hex::decode(private_key_hex)
        .map_err(|e| format!("Failed to decode private key: {}", e))?;
    
    if private_key_bytes.len() != 32 {
        return Err("Invalid private key length".to_string());
    }
    
    // Convert to fixed-size array for SecretKey::from_bytes
    let mut key_array = [0u8; 32];
    key_array.copy_from_slice(&private_key_bytes);
    
    // Use TryFrom trait for SecretKey
    use p256::elliptic_curve::FieldBytes;
    let field_bytes = FieldBytes::from(key_array);
    let secret = SecretKey::from_bytes(&field_bytes)
        .map_err(|e| format!("Failed to parse private key: {}", e))?;
    
    // Decode peer public key (SEC1 format: 0x04 || x || y)
    let peer_public_bytes = hex::decode(peer_public_key_hex)
        .map_err(|e| format!("Failed to decode peer public key: {}", e))?;
    
    // Use EncodedPoint to parse the public key
    // EncodedPoint implements From<&[u8]> or TryFrom
    let encoded_point = EncodedPoint::from_bytes(&peer_public_bytes)
        .map_err(|_| "Failed to parse peer public key bytes".to_string())?;
    
    let peer_public = PublicKey::from_encoded_point(&encoded_point)
        .ok_or_else(|| "Invalid peer public key point".to_string())?;
    
    // Derive shared secret using ECDH
    // Create EphemeralSecret from our private key
    let ephemeral_secret = EphemeralSecret::from(secret.to_nonzero_scalar());
    let shared_secret = ephemeral_secret.diffie_hellman(&peer_public);
    
    // Extract shared secret bytes (32 bytes)
    let shared_secret_bytes: [u8; 32] = shared_secret.raw_secret_bytes();
    Ok(hex::encode(shared_secret_bytes))
}

/// HKDF (HMAC-based Key Derivation Function) - RFC 5869.
///
/// Derives multiple keys from shared secret with proper key separation.
pub fn hkdf(
    shared_secret_hex: &str,
    salt: &str,
    info: &str,
    key_length: usize,
) -> Result<String, String> {
    let shared_secret = hex::decode(shared_secret_hex)
        .map_err(|e| format!("Failed to decode shared secret: {}", e))?;
    
    let salt_bytes = if salt.is_empty() {
        vec![0u8; 32]
    } else {
        salt.as_bytes().to_vec()
    };
    
    let info_bytes = info.as_bytes();
    
    let hkdf = Hkdf::<Sha256>::new(Some(&salt_bytes), &shared_secret);
    let mut okm = vec![0u8; key_length];
    hkdf.expand(info_bytes, &mut okm)
        .map_err(|e| format!("HKDF expansion failed: {}", e))?;
    
    Ok(hex::encode(okm))
}

/// Derive session keys from ECDH shared secret using HKDF.
///
/// Returns separate keys for encryption, MAC, and IV.
pub fn derive_session_keys(
    shared_secret_hex: &str,
    session_id: &str,
) -> Result<(String, String, String), String> {
    let salt = format!("ltp-v0.5-{}", session_id);
    
    let encryption_key = hkdf(shared_secret_hex, &salt, "ltp-encryption-key", 32)?;
    let mac_key = hkdf(shared_secret_hex, &salt, "ltp-mac-key", 32)?;
    let iv_key = hkdf(shared_secret_hex, &salt, "ltp-iv-key", 16)?;
    
    Ok((encryption_key, mac_key, iv_key))
}

/// Sign an ECDH public key to prevent MitM attacks (v0.6+).
///
/// Creates HMAC signature over: publicKey + entityId + timestamp
/// This authenticates the ephemeral ECDH key exchange.
pub fn sign_ecdh_public_key(
    public_key: &str,
    entity_id: &str,
    timestamp: i64,
    secret_key: &str,
) -> String {
    let input = format!("{}:{}:{}", public_key, entity_id, timestamp);
    hmac_sha256(&input, secret_key)
}

/// Verify ECDH public key signature (v0.6+).
///
/// Validates that the ephemeral ECDH public key was signed by the expected party.
/// Prevents MitM attacks on key exchange.
pub fn verify_ecdh_public_key(
    public_key: &str,
    entity_id: &str,
    timestamp: i64,
    signature: &str,
    secret_key: &str,
    max_age_ms: i64,
) -> Result<(), String> {
    // Check timestamp freshness
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    let age = now - timestamp;
    
    if age > max_age_ms {
        return Err(format!(
            "ECDH key signature expired (age: {}ms, max: {}ms)",
            age, max_age_ms
        ));
    }
    
    if age < -5000 {
        return Err(format!(
            "ECDH key signature from future (skew: {}ms)",
            -age
        ));
    }
    
    // Compute expected signature
    let input = format!("{}:{}:{}", public_key, entity_id, timestamp);
    let expected_signature = hmac_sha256(&input, secret_key);
    
    // Constant-time comparison
    if !constant_time_eq(signature.as_bytes(), expected_signature.as_bytes()) {
        return Err("ECDH key signature mismatch".to_string());
    }
    
    Ok(())
}

/// Generate a deterministic SHA-256 hash commitment for a canonical envelope.
pub fn hash_envelope(message: &Value) -> Result<String, String> {
    // Canonicalize message for hashing
    let canonical = canonicalize_message(message)?;
    let serialized = serde_json::to_string(&canonical)
        .map_err(|e| format!("Failed to serialize message: {}", e))?;
    
    let mut hasher = Sha256::new();
    hasher.update(serialized.as_bytes());
    Ok(hex::encode(hasher.finalize()))
}

/// Encrypt sensitive metadata fields to prevent tracking (v0.6+).
///
/// Encrypts thread_id, session_id, and timestamp using AES-256-GCM.
/// This prevents adversaries from tracking users across sessions.
pub fn encrypt_metadata(
    metadata: &Value,
    encryption_key_hex: &str,
) -> Result<String, String> {
    // Serialize metadata to JSON
    let metadata_json = serde_json::to_string(metadata)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
    
    // Decode encryption key
    let key_bytes = hex::decode(encryption_key_hex)
        .map_err(|e| format!("Failed to decode encryption key: {}", e))?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    
    // Generate random IV (12 bytes for GCM)
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    
    // Encrypt (AES-GCM automatically appends authentication tag)
    let ciphertext = cipher
        .encrypt(&nonce, metadata_json.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;
    
    // Format: ciphertext:iv:tag (colon-separated for easy parsing)
    // GCM includes auth tag at the end of ciphertext (last 16 bytes)
    let tag = &ciphertext[ciphertext.len() - 16..];
    let ciphertext_only = &ciphertext[..ciphertext.len() - 16];
    
    Ok(format!(
        "{}:{}:{}",
        hex::encode(ciphertext_only),
        hex::encode(nonce.as_slice()),
        hex::encode(tag)
    ))
}

/// Decrypt metadata fields (v0.6+).
pub fn decrypt_metadata(
    encrypted_metadata: &str,
    encryption_key_hex: &str,
) -> Result<Value, String> {
    // Parse format: ciphertext:iv:tag
    let parts: Vec<&str> = encrypted_metadata.split(':').collect();
    if parts.len() != 3 {
        return Err("Invalid encrypted metadata format - expected ciphertext:iv:tag".to_string());
    }
    
    let ciphertext_hex = parts[0];
    let iv_hex = parts[1];
    let tag_hex = parts[2];
    
    if ciphertext_hex.is_empty() || iv_hex.is_empty() || tag_hex.is_empty() {
        return Err("Invalid encrypted metadata format - missing parts".to_string());
    }
    
    // Decode components
    let ciphertext_only = hex::decode(ciphertext_hex)
        .map_err(|e| format!("Failed to decode ciphertext: {}", e))?;
    let tag = hex::decode(tag_hex)
        .map_err(|e| format!("Failed to decode tag: {}", e))?;
    let nonce_bytes = hex::decode(iv_hex)
        .map_err(|e| format!("Failed to decode IV: {}", e))?;
    
    // Combine ciphertext and tag
    let mut ciphertext = ciphertext_only;
    ciphertext.extend_from_slice(&tag);
    
    // Decode encryption key
    let key_bytes = hex::decode(encryption_key_hex)
        .map_err(|e| format!("Failed to decode encryption key: {}", e))?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    
    if nonce_bytes.len() != 12 {
        return Err("Invalid nonce length (expected 12 bytes)".to_string());
    }
    
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Decrypt (ciphertext includes tag at the end)
    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("Decryption failed: {}", e))?;
    
    // Parse JSON back to metadata
    let metadata: Value = serde_json::from_slice(&plaintext)
        .map_err(|e| format!("Failed to parse decrypted metadata: {}", e))?;
    
    // Validate structure
    if !metadata.get("thread_id").is_some()
        || !metadata.get("session_id").is_some()
        || !metadata.get("timestamp").is_some()
    {
        return Err("Invalid decrypted metadata structure".to_string());
    }
    
    Ok(metadata)
}

/// Generate routing tag for server-side message routing (v0.6+).
///
/// Creates HMAC-based tag that doesn't reveal thread_id or session_id.
/// Server can use this for routing without seeing plaintext metadata.
pub fn generate_routing_tag(
    thread_id: &str,
    session_id: &str,
    mac_key_hex: &str,
) -> Result<String, String> {
    let input = format!("{}:{}", thread_id, session_id);
    let mac_key = hex::decode(mac_key_hex)
        .map_err(|e| format!("Failed to decode MAC key: {}", e))?;
    
    let mut mac = HmacSha256::new_from_slice(&mac_key)
        .map_err(|e| format!("Failed to create HMAC: {}", e))?;
    mac.update(input.as_bytes());
    let hmac_result = hex::encode(mac.finalize().into_bytes());
    
    // Return first 32 hex characters (16 bytes) for routing tag
    Ok(hmac_result[..32].to_string())
}

/// Sign a message using HMAC-SHA256.
pub fn sign_message(message: &Value, secret_key: &str) -> Result<String, String> {
    let canonical = canonicalize_message(message)?;
    let serialized = serde_json::to_string(&canonical)
        .map_err(|e| format!("Failed to serialize message: {}", e))?;
    
    Ok(hmac_sha256(&serialized, secret_key))
}

/// Verify message signature using constant-time comparison.
pub fn verify_signature(message: &Value, secret_key: &str) -> Result<bool, String> {
    let provided_signature = message
        .get("signature")
        .and_then(|v| v.as_str())
        .ok_or("Missing signature field")?;
    
    let expected_signature = sign_message(message, secret_key)?;
    
    Ok(constant_time_eq(
        provided_signature.as_bytes(),
        expected_signature.as_bytes(),
    ))
}

// Private helpers

fn canonicalize_message(message: &Value) -> Result<Value, String> {
    // Extract canonical fields used for signing/verification
    let mut canonical = serde_json::json!({
        "type": message.get("type").and_then(|v| v.as_str()).unwrap_or(""),
        "thread_id": message.get("thread_id").and_then(|v| v.as_str()).unwrap_or(""),
        "session_id": message.get("session_id").and_then(|v| v.as_str()).unwrap_or(""),
        "timestamp": message.get("timestamp").and_then(|v| v.as_i64()).unwrap_or(0),
        "nonce": message.get("nonce").and_then(|v| v.as_str()).unwrap_or(""),
        "payload": message.get("payload").unwrap_or(&serde_json::json!({})),
        "meta": message.get("meta").unwrap_or(&serde_json::json!({})),
        "content_encoding": message.get("content_encoding").and_then(|v| v.as_str()).unwrap_or(""),
    });
    
    Ok(canonical)
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    
    let mut result = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        result |= x ^ y;
    }
    
    result == 0
}


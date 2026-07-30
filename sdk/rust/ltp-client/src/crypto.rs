//! Cryptographic helpers for the LTP Rust client.
//!
//! Provides ECDH key exchange, authenticated ECDH, HMAC-based nonces,
//! metadata encryption, and hash chaining functions for v0.6.0 security features.

use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit as AesKeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use hex;
use hkdf::Hkdf;
use hmac::{digest::KeyInit, Hmac, Mac};
use p256::elliptic_curve::sec1::ToEncodedPoint;
use p256::{EncodedPoint, SecretKey};
use rand::Rng;
use serde_json::Value;
use sha2::{Digest, Sha256};

pub type HmacSha256 = Hmac<Sha256>;

/// Compute HMAC-SHA256 for any string input.
///
/// Used for secure nonce generation and other HMAC operations.
pub fn hmac_sha256(input: &str, key: &str) -> String {
    let mut mac = <HmacSha256 as KeyInit>::new_from_slice(key.as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(input.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

/// Generate a nonce tied to a session MAC key (v0.6+).
///
/// Format: `hmac-{first 32 chars of HMAC}-{timestamp}` matching the Python,
/// JS, and Elixir SDKs. The HMAC is computed over `{timestamp}-{random hex}`
/// using the supplied `mac_key`; the random_hex is local entropy and is not
/// transmitted (parity with the other SDKs, which treat the nonce as an
/// opaque unique identifier for replay tracking).
pub fn generate_hmac_nonce(mac_key: &str) -> String {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let mut rng = rand::thread_rng();
    let random_bytes: [u8; 16] = rng.gen();
    let random_hex = hex::encode(random_bytes);

    let input = format!("{}-{}", timestamp, random_hex);
    let hmac = hmac_sha256(&input, mac_key);

    let hmac_prefix = if hmac.len() >= 32 {
        &hmac[..32]
    } else {
        &hmac[..]
    };

    format!("hmac-{}-{}", hmac_prefix, timestamp)
}

/// Generate ECDH key pair for key exchange.
///
/// Returns tuple of (public_key_hex, private_key_hex) using secp256r1 (P-256) curve.
pub fn generate_ecdh_key_pair() -> (String, String) {
    let secret = SecretKey::random(&mut OsRng);
    let public = secret.public_key();

    // Serialize keys to hex
    // Public key: uncompressed SEC1 format (0x04 || x || y)
    let encoded_point = public.to_encoded_point(false);
    let public_key_bytes = encoded_point.as_bytes();
    // Private key: 32 bytes
    let private_key_bytes = secret.to_bytes();

    (
        hex::encode(public_key_bytes),
        hex::encode(private_key_bytes),
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
    use p256::AffinePoint;

    // Decode private key
    let private_key_bytes =
        hex::decode(private_key_hex).map_err(|e| format!("Failed to decode private key: {}", e))?;

    if private_key_bytes.len() != 32 {
        return Err("Invalid private key length".to_string());
    }

    // Convert to fixed-size array for SecretKey::from_bytes
    let mut key_array = [0u8; 32];
    key_array.copy_from_slice(&private_key_bytes);

    // Use TryFrom trait for SecretKey
    let field_bytes = p256::FieldBytes::from(key_array);
    let secret = SecretKey::from_bytes(&field_bytes)
        .map_err(|e| format!("Failed to parse private key: {}", e))?;

    // Decode peer public key (SEC1 format: 0x04 || x || y)
    let peer_public_bytes = hex::decode(peer_public_key_hex)
        .map_err(|e| format!("Failed to decode peer public key: {}", e))?;

    // Use EncodedPoint to parse the public key
    // EncodedPoint implements From<&[u8]> or TryFrom
    let encoded_point = EncodedPoint::from_bytes(&peer_public_bytes)
        .map_err(|_| "Failed to parse peer public key bytes".to_string())?;

    let peer_public = Option::<AffinePoint>::from(AffinePoint::from_encoded_point(&encoded_point))
        .ok_or_else(|| "Invalid peer public key point".to_string())?;

    // Derive shared secret using ECDH
    use p256::ecdh::diffie_hellman;

    let shared_secret = diffie_hellman(secret.to_nonzero_scalar(), peer_public);

    // Extract shared secret bytes (32 bytes)
    let shared_secret_bytes = shared_secret.raw_secret_bytes();
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
    // Check timestamp freshness. Peers in other SDKs may send the timestamp
    // either in milliseconds or in seconds; detect the seconds form by
    // comparing against ~year-2001 in ms and normalise to ms.
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    let timestamp_ms = if timestamp < 1_000_000_000_000 {
        timestamp.saturating_mul(1000)
    } else {
        timestamp
    };
    let age = now - timestamp_ms;

    if age > max_age_ms {
        return Err(format!(
            "ECDH key signature expired (age: {}ms, max: {}ms)",
            age, max_age_ms
        ));
    }

    if age < -5000 {
        return Err(format!("ECDH key signature from future (skew: {}ms)", -age));
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

/// Generate a deterministic SHA-256 hash commitment for Canonical Envelope v1.
pub fn hash_envelope(message: &Value) -> Result<String, String> {
    let serialized = serialize_canonical(message)?;
    let mut hasher = Sha256::new();
    hasher.update(serialized.as_bytes());
    Ok(hex::encode(hasher.finalize()))
}

/// Encrypt sensitive metadata fields to prevent tracking (v0.6+).
///
/// Encrypts thread_id, session_id, and timestamp using AES-256-GCM.
/// This prevents adversaries from tracking users across sessions.
pub fn encrypt_metadata(metadata: &Value, encryption_key_hex: &str) -> Result<String, String> {
    // Serialize metadata to JSON
    let metadata_json = serde_json::to_string(metadata)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;

    // Decode encryption key
    let key_bytes = hex::decode(encryption_key_hex)
        .map_err(|e| format!("Failed to decode encryption key: {}", e))?;
    let cipher =
        Aes256Gcm::new_from_slice(&key_bytes).map_err(|e| format!("Invalid key length: {}", e))?;

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
        hex::encode(&nonce),
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
    let ciphertext_only =
        hex::decode(ciphertext_hex).map_err(|e| format!("Failed to decode ciphertext: {}", e))?;
    let tag = hex::decode(tag_hex).map_err(|e| format!("Failed to decode tag: {}", e))?;
    let nonce_bytes = hex::decode(iv_hex).map_err(|e| format!("Failed to decode IV: {}", e))?;

    // Combine ciphertext and tag
    let mut ciphertext = ciphertext_only;
    ciphertext.extend_from_slice(&tag);

    // Decode encryption key
    let key_bytes = hex::decode(encryption_key_hex)
        .map_err(|e| format!("Failed to decode encryption key: {}", e))?;
    let cipher =
        Aes256Gcm::new_from_slice(&key_bytes).map_err(|e| format!("Invalid key length: {}", e))?;

    let nonce_array: [u8; 12] = nonce_bytes
        .try_into()
        .map_err(|_| "Invalid nonce length (expected 12 bytes)".to_string())?;
    let nonce = Nonce::from(nonce_array);

    // Decrypt (ciphertext includes tag at the end)
    let plaintext = cipher
        .decrypt(&nonce, ciphertext.as_ref())
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
    let mac_key =
        hex::decode(mac_key_hex).map_err(|e| format!("Failed to decode MAC key: {}", e))?;

    let mut mac = <HmacSha256 as KeyInit>::new_from_slice(&mac_key)
        .map_err(|e| format!("Failed to create HMAC: {}", e))?;
    mac.update(input.as_bytes());
    let hmac_result = hex::encode(mac.finalize().into_bytes());

    // Return first 32 hex characters (16 bytes) for routing tag
    Ok(hmac_result[..32].to_string())
}

/// Sign a message using HMAC-SHA256 over Canonical Envelope v1 bytes.
pub fn sign_message(message: &Value, secret_key: &str) -> Result<String, String> {
    Ok(hmac_sha256(&serialize_canonical(message)?, secret_key))
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

/// Serialize the protocol signing fields using RFC 8785/JCS-compatible rules.
pub fn serialize_canonical(message: &Value) -> Result<String, String> {
    let canonical = serde_json::json!({
        "type": message.get("type").and_then(Value::as_str).unwrap_or(""),
        "thread_id": message.get("thread_id").and_then(Value::as_str).unwrap_or(""),
        "session_id": message.get("session_id").and_then(Value::as_str).unwrap_or(""),
        "timestamp": message.get("timestamp").cloned().unwrap_or_else(|| Value::from(0)),
        "nonce": message.get("nonce").and_then(Value::as_str).unwrap_or(""),
        "payload": message.get("payload").cloned().unwrap_or_else(|| serde_json::json!({})),
        "prev_message_hash": message.get("prev_message_hash").and_then(Value::as_str).unwrap_or(""),
        "meta": message.get("meta").cloned().unwrap_or_else(|| serde_json::json!({})),
        "content_encoding": message.get("content_encoding").and_then(Value::as_str).unwrap_or(""),
    });

    let mut output = String::new();
    write_canonical_json(&canonical, &mut output)?;
    Ok(output)
}

fn write_canonical_json(value: &Value, output: &mut String) -> Result<(), String> {
    match value {
        Value::Null => output.push_str("null"),
        Value::Bool(flag) => output.push_str(if *flag { "true" } else { "false" }),
        Value::String(text) => output.push_str(
            &serde_json::to_string(text).map_err(|e| format!("Failed to encode string: {}", e))?,
        ),
        Value::Number(number) => output.push_str(&serialize_number(number)?),
        Value::Array(items) => {
            output.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                write_canonical_json(item, output)?;
            }
            output.push(']');
        }
        Value::Object(map) => {
            let mut entries: Vec<_> = map.iter().collect();
            entries.sort_by(|(left, _), (right, _)| left.encode_utf16().cmp(right.encode_utf16()));
            output.push('{');
            for (index, (key, item)) in entries.into_iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                output.push_str(
                    &serde_json::to_string(key)
                        .map_err(|e| format!("Failed to encode object key: {}", e))?,
                );
                output.push(':');
                write_canonical_json(item, output)?;
            }
            output.push('}');
        }
    }
    Ok(())
}

fn serialize_number(number: &serde_json::Number) -> Result<String, String> {
    const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

    if let Some(value) = number.as_i64() {
        if value.unsigned_abs() > MAX_SAFE_INTEGER {
            return Err("Canonical Envelope v1 rejects unsafe integer".to_string());
        }
        return Ok(value.to_string());
    }
    if let Some(value) = number.as_u64() {
        if value > MAX_SAFE_INTEGER {
            return Err("Canonical Envelope v1 rejects unsafe integer".to_string());
        }
        return Ok(value.to_string());
    }

    let value = number
        .as_f64()
        .ok_or_else(|| "Canonical Envelope v1 rejects invalid number".to_string())?;
    if !value.is_finite() {
        return Err("Canonical Envelope v1 rejects NaN and Infinity".to_string());
    }
    if value == 0.0 {
        return Ok("0".to_string());
    }
    if value.fract() == 0.0 && value.abs() > MAX_SAFE_INTEGER as f64 {
        return Err("Canonical Envelope v1 rejects unsafe integer".to_string());
    }

    let raw = value.to_string().to_lowercase();
    let absolute = value.abs();
    if (1e-6..1e21).contains(&absolute) {
        let fixed = if raw.contains('e') {
            expand_scientific(&raw)?
        } else {
            raw
        };
        return Ok(trim_fraction(fixed));
    }

    if raw.contains('e') {
        normalize_exponent(&raw)
    } else {
        fixed_to_scientific(&raw)
    }
}

fn trim_fraction(mut raw: String) -> String {
    if raw.contains('.') {
        while raw.ends_with('0') {
            raw.pop();
        }
        if raw.ends_with('.') {
            raw.pop();
        }
    }
    raw
}

fn normalize_exponent(raw: &str) -> Result<String, String> {
    let (mantissa, exponent_text) = raw
        .split_once('e')
        .ok_or_else(|| "Invalid scientific number".to_string())?;
    let exponent: i32 = exponent_text
        .parse()
        .map_err(|_| "Invalid scientific exponent".to_string())?;
    let mantissa = mantissa.strip_suffix(".0").unwrap_or(mantissa);
    Ok(format!(
        "{}e{}{}",
        mantissa,
        if exponent >= 0 { "+" } else { "-" },
        exponent.abs()
    ))
}

fn expand_scientific(raw: &str) -> Result<String, String> {
    let (mantissa, exponent_text) = raw
        .split_once('e')
        .ok_or_else(|| "Invalid scientific number".to_string())?;
    let exponent: i32 = exponent_text
        .parse()
        .map_err(|_| "Invalid scientific exponent".to_string())?;
    let negative = mantissa.starts_with('-');
    let mantissa = mantissa.trim_start_matches('-');
    let decimal_index = mantissa.find('.').unwrap_or(mantissa.len()) as i32;
    let digits: String = mantissa.chars().filter(|ch| *ch != '.').collect();
    let new_index = decimal_index + exponent;
    let body = if new_index <= 0 {
        format!("0.{}{}", "0".repeat((-new_index) as usize), digits)
    } else if new_index as usize >= digits.len() {
        format!(
            "{}{}",
            digits,
            "0".repeat(new_index as usize - digits.len())
        )
    } else {
        format!(
            "{}.{}",
            &digits[..new_index as usize],
            &digits[new_index as usize..]
        )
    };
    Ok(if negative { format!("-{}", body) } else { body })
}

fn fixed_to_scientific(raw: &str) -> Result<String, String> {
    let negative = raw.starts_with('-');
    let raw = raw.trim_start_matches('-');
    let (integer, fraction) = raw.split_once('.').unwrap_or((raw, ""));

    let (digits, exponent) = if let Some(index) = integer.bytes().position(|ch| ch != b'0') {
        (
            format!("{}{}", &integer[index..], fraction),
            integer.len() as i32 - index as i32 - 1,
        )
    } else if let Some(index) = fraction.bytes().position(|ch| ch != b'0') {
        (fraction[index..].to_string(), -(index as i32) - 1)
    } else {
        return Ok("0".to_string());
    };

    let digits = digits.trim_end_matches('0');
    let mut mantissa = digits[..1].to_string();
    if digits.len() > 1 {
        mantissa.push('.');
        mantissa.push_str(&digits[1..]);
    }
    if negative {
        mantissa.insert(0, '-');
    }
    Ok(format!(
        "{}e{}{}",
        mantissa,
        if exponent >= 0 { "+" } else { "-" },
        exponent.abs()
    ))
}

// Private helpers

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

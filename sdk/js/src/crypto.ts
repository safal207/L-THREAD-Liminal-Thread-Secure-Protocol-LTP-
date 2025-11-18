/**
 * LTP Cryptographic Utilities
 * Version 0.4
 *
 * Provides cryptographic functions for message signing and verification
 */

/**
 * Helper to safely extract error message from unknown error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Compute HMAC-SHA256 for any string input
 * Used for secure nonce generation and other HMAC operations
 */
export async function hmacSha256(input: string, key: string): Promise<string> {
  // Browser environment - Web Crypto API
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(key);
      const inputData = encoder.encode(input);

      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, inputData);

      return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (error) {
      throw new Error(`Failed to compute HMAC (Web Crypto): ${getErrorMessage(error)}`);
    }
  }

  // Node.js environment - crypto module
  if (typeof require !== 'undefined') {
    try {
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', key);
      hmac.update(input);
      return hmac.digest('hex');
    } catch (error) {
      throw new Error(`Failed to compute HMAC (Node.js crypto): ${getErrorMessage(error)}`);
    }
  }

  throw new Error('No cryptographic implementation available for HMAC');
}

/**
 * Sign an ECDH public key to prevent MitM attacks (v0.6+)
 *
 * Creates HMAC signature over: publicKey + entityId + timestamp
 * This authenticates the ephemeral ECDH key exchange
 *
 * @param publicKey - Hex-encoded ECDH public key
 * @param entityId - client_id (for client) or session_id (for server)
 * @param timestamp - Unix timestamp in milliseconds
 * @param secretKey - Long-term secret key for signing
 * @returns Hex-encoded HMAC-SHA256 signature
 */
export async function signEcdhPublicKey(
  publicKey: string,
  entityId: string,
  timestamp: number,
  secretKey: string
): Promise<string> {
  const input = `${publicKey}:${entityId}:${timestamp}`;
  return await hmacSha256(input, secretKey);
}

/**
 * Verify ECDH public key signature (v0.6+)
 *
 * Validates that the ephemeral ECDH public key was signed by the expected party
 * Prevents MitM attacks on key exchange
 *
 * @param publicKey - Hex-encoded ECDH public key
 * @param entityId - client_id (for client) or session_id (for server)
 * @param timestamp - Unix timestamp in milliseconds
 * @param signature - Hex-encoded HMAC-SHA256 signature to verify
 * @param secretKey - Long-term secret key for verification
 * @param maxAge - Maximum age of signature in milliseconds (default: 300000 = 5 minutes)
 * @returns true if signature is valid, false otherwise
 */
export async function verifyEcdhPublicKey(
  publicKey: string,
  entityId: string,
  timestamp: number,
  signature: string,
  secretKey: string,
  maxAge: number = 300000
): Promise<{ valid: boolean; error?: string }> {
  // Check timestamp freshness
  const now = Date.now();
  const age = now - timestamp;

  if (age > maxAge) {
    return { valid: false, error: `ECDH key signature expired (age: ${age}ms, max: ${maxAge}ms)` };
  }

  if (age < -5000) {
    return { valid: false, error: `ECDH key signature from future (skew: ${-age}ms)` };
  }

  // Compute expected signature
  const input = `${publicKey}:${entityId}:${timestamp}`;
  const expectedSignature = await hmacSha256(input, secretKey);

  // Constant-time comparison
  if (!timingSafeEqual(signature, expectedSignature)) {
    return { valid: false, error: 'ECDH key signature mismatch' };
  }

  return { valid: true };
}

/**
 * Deterministically serialize objects by sorting keys recursively.
 */
function canonicalize(value: any): any {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, any>>((acc, key) => {
        acc[key] = canonicalize((value as Record<string, any>)[key]);
        return acc;
      }, {});
  }

  return value;
}

function serializeCanonical(message: {
  type: string;
  thread_id: string;
  session_id?: string;
  timestamp: number;
  nonce: string;
  payload: any;
  prev_message_hash?: string;
  meta?: any;
  content_encoding?: string;
}): string {
  const canonical = canonicalize({
    type: message.type,
    thread_id: message.thread_id,
    session_id: message.session_id || '',
    timestamp: message.timestamp,
    nonce: message.nonce,
    payload: message.payload,
    prev_message_hash: message.prev_message_hash || '',
    meta: message.meta || {},
    content_encoding: message.content_encoding || '',
  });

  return JSON.stringify(canonical);
}

/**
 * Generate HMAC-SHA256 signature for LTP message
 * Works in both browser (Web Crypto API) and Node.js (crypto module)
 */
export async function signMessage(
  message: {
    type: string;
    thread_id: string;
    session_id?: string;
    timestamp: number;
    nonce: string;
    payload: any;
    prev_message_hash?: string;
    meta?: any;
    content_encoding?: string;
  },
  secretKey: string
): Promise<string> {
  // Create canonical message representation
  const canonical = serializeCanonical(message);

  // Browser environment - Web Crypto API
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secretKey);
      const messageData = encoder.encode(canonical);

      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, messageData);

      // Convert to hex string
      return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (error) {
      throw new Error(`Failed to sign message (Web Crypto): ${getErrorMessage(error)}`);
    }
  }

  // Node.js environment
  if (typeof require !== 'undefined') {
    try {
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', secretKey);
      hmac.update(canonical);
      return hmac.digest('hex');
    } catch (error) {
      throw new Error(`Failed to sign message (Node.js crypto): ${getErrorMessage(error)}`);
    }
  }

  throw new Error('No cryptographic implementation available');
}

/**
 * Verify HMAC-SHA256 signature for LTP message
 * Uses timing-safe comparison to prevent timing attacks
 */
export async function verifySignature(
  message: {
    type: string;
    thread_id: string;
    session_id?: string;
    timestamp: number;
    nonce: string;
    payload: any;
    signature: string;
    prev_message_hash?: string;
    meta?: any;
    content_encoding?: string;
  },
  secretKey: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Calculate expected signature
    const expectedSignature = await signMessage(
      {
        type: message.type,
        thread_id: message.thread_id,
        session_id: message.session_id,
        timestamp: message.timestamp,
        nonce: message.nonce,
        payload: message.payload,
        prev_message_hash: message.prev_message_hash,
        meta: message.meta,
        content_encoding: message.content_encoding,
      },
      secretKey
    );

    // Timing-safe comparison
    const isValid = timingSafeEqual(expectedSignature, message.signature);

    return { valid: isValid };
  } catch (error) {
    return { valid: false, error: getErrorMessage(error) };
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * Ensures comparison takes constant time regardless of where strings differ
 * or if lengths are different
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Node.js environment - use native crypto.timingSafeEqual
  if (typeof require !== 'undefined') {
    try {
      const crypto = require('crypto');
      // Native implementation handles length mismatch safely
      if (a.length !== b.length) {
        // Still do constant-time comparison of same-length dummy values
        // to prevent timing leak from early return
        const dummyA = Buffer.alloc(32);
        const dummyB = Buffer.alloc(32);
        crypto.timingSafeEqual(dummyA, dummyB);
        return false;
      }
      return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
    } catch (error) {
      // Fall through to manual implementation
    }
  }

  // Browser environment or fallback - constant-time comparison
  // Always compare max(a.length, b.length) characters to prevent timing leak
  const maxLen = Math.max(a.length, b.length);
  let result = a.length ^ b.length; // Include length difference in result

  for (let i = 0; i < maxLen; i++) {
    const aChar = i < a.length ? a.charCodeAt(i) : 0;
    const bChar = i < b.length ? b.charCodeAt(i) : 0;
    result |= aChar ^ bChar;
  }

  return result === 0;
}

/**
 * Generate a deterministic SHA-256 hash commitment for a canonical envelope.
 */
export async function hashEnvelope(message: {
  type: string;
  thread_id: string;
  session_id?: string;
  timestamp: number;
  nonce: string;
  payload: any;
  prev_message_hash?: string;
}): Promise<string> {
  const canonical = serializeCanonical(message);

  // Browser environment - Web Crypto API
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const digest = await window.crypto.subtle.digest('SHA-256', encoder.encode(canonical));
    return bufferToHex(new Uint8Array(digest));
  }

  // Node.js environment
  if (typeof require !== 'undefined') {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(canonical);
    return hash.digest('hex');
  }

  throw new Error('No cryptographic implementation available for hashing');
}

/**
 * Generate ECDH key pair for key exchange
 * Returns public and private keys in hex format
 */
export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  // Browser environment - Web Crypto API
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256', // Also known as secp256r1
        },
        true, // extractable
        ['deriveKey', 'deriveBits']
      );

      // Export public key
      const publicKeyRaw = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
      const publicKeyHex = Array.from(new Uint8Array(publicKeyRaw))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Export private key
      const privateKeyRaw = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
      const privateKeyHex = Array.from(new Uint8Array(privateKeyRaw))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      return {
        publicKey: publicKeyHex,
        privateKey: privateKeyHex,
      };
    } catch (error) {
      throw new Error(`Failed to generate key pair (Web Crypto): ${getErrorMessage(error)}`);
    }
  }

  // Node.js environment
  if (typeof require !== 'undefined') {
    try {
      const crypto = require('crypto');
      const ecdh = crypto.createECDH('prime256v1'); // P-256
      ecdh.generateKeys();

      return {
        publicKey: ecdh.getPublicKey('hex'),
        privateKey: ecdh.getPrivateKey('hex'),
      };
    } catch (error) {
      throw new Error(`Failed to generate key pair (Node.js crypto): ${getErrorMessage(error)}`);
    }
  }

  throw new Error('No cryptographic implementation available');
}

/**
 * Derive shared secret from ECDH key exchange
 * Works in both browser and Node.js
 */
export async function deriveSharedSecret(
  privateKey: string,
  peerPublicKey: string
): Promise<string> {
  // Browser environment - Web Crypto API
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      // Import private key (PKCS8 format)
      const privateKeyBuffer = hexToBuffer(privateKey);
      const cryptoPrivateKey = await window.crypto.subtle.importKey(
        'pkcs8',
        privateKeyBuffer,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveBits']
      );

      // Import peer public key (raw format)
      const publicKeyBuffer = hexToBuffer(peerPublicKey);
      const cryptoPeerPublicKey = await window.crypto.subtle.importKey(
        'raw',
        publicKeyBuffer,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
      );

      // Derive shared secret
      const sharedSecret = await window.crypto.subtle.deriveBits(
        { name: 'ECDH', public: cryptoPeerPublicKey },
        cryptoPrivateKey,
        256 // P-256 produces 256 bits
      );

      return bufferToHex(new Uint8Array(sharedSecret));
    } catch (error) {
      throw new Error(`Failed to derive shared secret (Web Crypto): ${getErrorMessage(error)}`);
    }
  }

  // Node.js environment
  if (typeof require !== 'undefined') {
    try {
      const crypto = require('crypto');
      const ecdh = crypto.createECDH('prime256v1');
      ecdh.setPrivateKey(Buffer.from(privateKey, 'hex'));

      const sharedSecret = ecdh.computeSecret(Buffer.from(peerPublicKey, 'hex'));
      return sharedSecret.toString('hex');
    } catch (error) {
      throw new Error(`Failed to derive shared secret (Node.js): ${getErrorMessage(error)}`);
    }
  }

  throw new Error('No cryptographic implementation available');
}

/**
 * HKDF (HMAC-based Key Derivation Function) - RFC 5869
 * Derives multiple keys from shared secret with proper key separation
 */
export async function hkdf(
  sharedSecret: string,
  salt: string,
  info: string,
  keyLength: number = 32
): Promise<string> {
  // Browser environment - Web Crypto API
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();

      // Import shared secret as key material
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        hexToBuffer(sharedSecret),
        'HKDF',
        false,
        ['deriveBits']
      );

      // Derive key using HKDF
      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: encoder.encode(salt),
          info: encoder.encode(info),
        },
        keyMaterial,
        keyLength * 8 // Convert bytes to bits
      );

      return bufferToHex(new Uint8Array(derivedBits));
    } catch (error) {
      throw new Error(`Failed HKDF (Web Crypto): ${getErrorMessage(error)}`);
    }
  }

  // Node.js environment - Manual HKDF implementation
  if (typeof require !== 'undefined') {
    try {
      const crypto = require('crypto');

      // HKDF Extract
      const hmacSalt = crypto.createHmac('sha256', salt || Buffer.alloc(32));
      hmacSalt.update(Buffer.from(sharedSecret, 'hex'));
      const prk = hmacSalt.digest();

      // HKDF Expand
      const infoBuffer = Buffer.from(info, 'utf8');
      const n = Math.ceil(keyLength / 32);
      let t = Buffer.alloc(0);
      let okm = Buffer.alloc(0);

      for (let i = 0; i < n; i++) {
        const hmac = crypto.createHmac('sha256', prk);
        hmac.update(t);
        hmac.update(infoBuffer);
        hmac.update(Buffer.from([i + 1]));
        t = hmac.digest();
        okm = Buffer.concat([okm, t]);
      }

      return okm.slice(0, keyLength).toString('hex');
    } catch (error) {
      throw new Error(`Failed HKDF (Node.js): ${getErrorMessage(error)}`);
    }
  }

  throw new Error('No cryptographic implementation available');
}

/**
 * Derive session keys from ECDH shared secret using HKDF
 * Returns separate keys for encryption, MAC, and IV
 */
export async function deriveSessionKeys(
  sharedSecret: string,
  sessionId: string
): Promise<{
  encryptionKey: string;
  macKey: string;
  ivKey: string;
}> {
  const salt = `ltp-v0.5-${sessionId}`;

  const [encryptionKey, macKey, ivKey] = await Promise.all([
    hkdf(sharedSecret, salt, 'ltp-encryption-key', 32),
    hkdf(sharedSecret, salt, 'ltp-mac-key', 32),
    hkdf(sharedSecret, salt, 'ltp-iv-key', 16),
  ]);

  return { encryptionKey, macKey, ivKey };
}

/**
 * Encrypt payload with AES-256-GCM
 * Returns encrypted data and authentication tag
 */
export async function encryptPayload(
  data: string,
  key: string
): Promise<{ ciphertext: string; iv: string; tag: string }> {
  // Node.js environment
  if (typeof require !== 'undefined') {
    try {
      const crypto = require('crypto');

      // Generate random IV (12 bytes for GCM)
      const iv = crypto.randomBytes(12);

      // Create cipher
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        Buffer.from(key.substring(0, 64), 'hex'), // Use first 32 bytes (64 hex chars)
        iv
      );

      // Encrypt
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const tag = cipher.getAuthTag();

      return {
        ciphertext: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
      };
    } catch (error) {
      throw new Error(`Failed to encrypt payload: ${getErrorMessage(error)}`);
    }
  }

  // Browser environment - Web Crypto API
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      // Generate random IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // Import key
      const keyBuffer = hexToBuffer(key.substring(0, 64));
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      // Encrypt
      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        cryptoKey,
        dataBuffer
      );

      // GCM mode includes auth tag in the output
      const encryptedArray = new Uint8Array(encrypted);
      const ciphertext = encryptedArray.slice(0, -16); // Last 16 bytes are tag
      const tag = encryptedArray.slice(-16);

      return {
        ciphertext: bufferToHex(ciphertext),
        iv: bufferToHex(iv),
        tag: bufferToHex(tag),
      };
    } catch (error) {
      throw new Error(`Failed to encrypt payload (Web Crypto): ${getErrorMessage(error)}`);
    }
  }

  throw new Error('No cryptographic implementation available');
}

/**
 * Decrypt payload with AES-256-GCM
 */
export async function decryptPayload(
  ciphertext: string,
  key: string,
  iv: string,
  tag: string
): Promise<string> {
  // Node.js environment
  if (typeof require !== 'undefined') {
    try {
      const crypto = require('crypto');

      // Create decipher
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(key.substring(0, 64), 'hex'),
        Buffer.from(iv, 'hex')
      );

      // Set auth tag
      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      // Decrypt
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Failed to decrypt payload: ${getErrorMessage(error)}`);
    }
  }

  // Browser environment
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      // Import key
      const keyBuffer = hexToBuffer(key.substring(0, 64));
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      // Combine ciphertext and tag
      const ciphertextBuffer = hexToBuffer(ciphertext);
      const tagBuffer = hexToBuffer(tag);
      const combined = new Uint8Array(ciphertextBuffer.byteLength + tagBuffer.byteLength);
      combined.set(new Uint8Array(ciphertextBuffer), 0);
      combined.set(new Uint8Array(tagBuffer), ciphertextBuffer.byteLength);

      // Decrypt
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: hexToBuffer(iv) },
        cryptoKey,
        combined
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      throw new Error(`Failed to decrypt payload (Web Crypto): ${getErrorMessage(error)}`);
    }
  }

  throw new Error('No cryptographic implementation available');
}

// Helper functions
function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Encrypt sensitive metadata fields to prevent tracking (v0.6+)
 *
 * Encrypts thread_id, session_id, and timestamp using AES-256-GCM
 * This prevents adversaries from tracking users across sessions
 *
 * @param metadata - Metadata object containing thread_id, session_id, timestamp
 * @param encryptionKey - Hex-encoded 256-bit encryption key (from HKDF)
 * @returns Encrypted metadata blob (ciphertext:iv:tag format)
 */
export async function encryptMetadata(
  metadata: {
    thread_id: string;
    session_id: string;
    timestamp: number;
  },
  encryptionKey: string
): Promise<string> {
  // Serialize metadata to JSON
  const metadataJson = JSON.stringify({
    thread_id: metadata.thread_id,
    session_id: metadata.session_id,
    timestamp: metadata.timestamp,
  });

  // Encrypt using AES-256-GCM
  const encrypted = await encryptPayload(metadataJson, encryptionKey);

  // Format: ciphertext:iv:tag (colon-separated for easy parsing)
  return `${encrypted.ciphertext}:${encrypted.iv}:${encrypted.tag}`;
}

/**
 * Decrypt metadata fields (v0.6+)
 *
 * @param encryptedMetadata - Encrypted metadata blob (ciphertext:iv:tag format)
 * @param encryptionKey - Hex-encoded 256-bit encryption key
 * @returns Decrypted metadata object
 */
export async function decryptMetadata(
  encryptedMetadata: string,
  encryptionKey: string
): Promise<{
  thread_id: string;
  session_id: string;
  timestamp: number;
}> {
  // Parse format: ciphertext:iv:tag
  const parts = encryptedMetadata.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted metadata format - expected ciphertext:iv:tag');
  }

  const [ciphertext, iv, tag] = parts;

  // Decrypt using AES-256-GCM
  const decryptedJson = await decryptPayload({ ciphertext, iv, tag }, encryptionKey);

  // Parse JSON back to metadata object
  const metadata = JSON.parse(decryptedJson);

  if (!metadata.thread_id || !metadata.session_id || typeof metadata.timestamp !== 'number') {
    throw new Error('Invalid decrypted metadata structure');
  }

  return {
    thread_id: metadata.thread_id,
    session_id: metadata.session_id,
    timestamp: metadata.timestamp,
  };
}

/**
 * Generate routing tag for server-side message routing (v0.6+)
 *
 * Creates HMAC-based tag that doesn't reveal thread_id or session_id
 * Server can use this for routing without seeing plaintext metadata
 *
 * @param threadId - Thread identifier
 * @param sessionId - Session identifier
 * @param macKey - Hex-encoded MAC key (from HKDF)
 * @returns Routing tag (first 32 hex characters of HMAC)
 */
export async function generateRoutingTag(
  threadId: string,
  sessionId: string,
  macKey: string
): Promise<string> {
  const input = `${threadId}:${sessionId}`;
  const hmac = await hmacSha256(input, macKey);
  // Return first 32 hex characters (16 bytes) for routing tag
  return hmac.substring(0, 32);
}
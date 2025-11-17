/**
 * LTP Cryptographic Utilities
 * Version 0.4
 *
 * Provides cryptographic functions for message signing and verification
 */

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
  },
  secretKey: string
): Promise<string> {
  // Create canonical message representation
  const canonical = JSON.stringify({
    type: message.type,
    thread_id: message.thread_id,
    session_id: message.session_id || '',
    timestamp: message.timestamp,
    nonce: message.nonce,
    payload: message.payload,
  });

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
      throw new Error(`Failed to sign message (Web Crypto): ${error.message}`);
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
      throw new Error(`Failed to sign message (Node.js crypto): ${error.message}`);
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
      },
      secretKey
    );

    // Timing-safe comparison
    const isValid = timingSafeEqual(expectedSignature, message.signature);

    return { valid: isValid };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * Ensures comparison takes constant time regardless of where strings differ
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  // Node.js environment - use native crypto.timingSafeEqual
  if (typeof require !== 'undefined') {
    try {
      const crypto = require('crypto');
      return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
    } catch (error) {
      // Fall through to manual implementation
    }
  }

  // Browser environment or fallback - constant-time comparison
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
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
      throw new Error(`Failed to generate key pair (Web Crypto): ${error.message}`);
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
      throw new Error(`Failed to generate key pair (Node.js crypto): ${error.message}`);
    }
  }

  throw new Error('No cryptographic implementation available');
}

/**
 * Derive shared secret from ECDH key exchange
 */
export async function deriveSharedSecret(
  privateKey: string,
  peerPublicKey: string
): Promise<string> {
  // Node.js environment
  if (typeof require !== 'undefined') {
    try {
      const crypto = require('crypto');
      const ecdh = crypto.createECDH('prime256v1');
      ecdh.setPrivateKey(Buffer.from(privateKey, 'hex'));

      const sharedSecret = ecdh.computeSecret(Buffer.from(peerPublicKey, 'hex'));
      return sharedSecret.toString('hex');
    } catch (error) {
      throw new Error(`Failed to derive shared secret: ${error.message}`);
    }
  }

  // Browser environment would require more complex implementation
  throw new Error('ECDH key derivation only supported in Node.js environment for now');
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
      throw new Error(`Failed to encrypt payload: ${error.message}`);
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
      throw new Error(`Failed to encrypt payload (Web Crypto): ${error.message}`);
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
      throw new Error(`Failed to decrypt payload: ${error.message}`);
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
      throw new Error(`Failed to decrypt payload (Web Crypto): ${error.message}`);
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

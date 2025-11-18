# LTP Security Hardening Guide

## Overview

This guide provides comprehensive security hardening recommendations for deploying L-THREAD/LTP in production environments. Follow these guidelines to ensure your LTP deployment is secure against common vulnerabilities.

### What changed in v0.5 (this branch)

- **Deterministic envelopes**: all SDK signatures now use canonical, key-sorted JSON that includes `prev_message_hash`, eliminating ambiguity in HMAC inputs.
- **Hash chaining**: every envelope carries the previous message hash so clients can reject re-ordered or spliced packets before application handling.
- **ECDH-derived MAC keys**: the JavaScript and Python clients now negotiate a `secp256r1` key during handshake and derive a session MAC key via HKDF-SHA256, enabling security-by-default without pre-shared secrets.
- **Replay defences tightened**: timestamp, nonce, and hash-chain checks all gate message dispatch when signature verification is required.

---

## Table of Contents

1. [Cryptographic Security](#cryptographic-security)
2. [Transport Layer Security](#transport-layer-security)
3. [Authentication & Authorization](#authentication--authorization)
4. [Rate Limiting & DoS Protection](#rate-limiting--dos-protection)
5. [Input Validation](#input-validation)
6. [Replay Attack Prevention](#replay-attack-prevention)
7. [Session Management](#session-management)
8. [Monitoring & Logging](#monitoring--logging)
9. [Production Checklist](#production-checklist)

---

## Cryptographic Security

### Nonce Generation

**Critical:** All SDKs now use cryptographically secure random number generation.

#### JavaScript/TypeScript SDK

```typescript
// ✅ GOOD: Uses Web Crypto API (crypto.getRandomValues)
// Already implemented in v0.3.1+
private generateSecureRandomHex(byteLength: number): string {
  if (typeof window !== 'undefined' && window.crypto) {
    const randomBytes = new Uint8Array(byteLength);
    window.crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Node.js fallback
  const crypto = require('crypto');
  return crypto.randomBytes(byteLength).toString('hex');
}
```

#### Python SDK

```python
# ✅ GOOD: Uses secrets module (CSPRNG)
# Already implemented in v0.3.1+
import secrets

def _generate_nonce(self) -> str:
    random_hex = secrets.token_hex(8)
    return f"{self.client_id}-{int(time.time() * 1000)}-{random_hex}"
```

#### Elixir SDK

```elixir
# ✅ GOOD: Uses :crypto.strong_rand_bytes
# Already implemented
defp generate_nonce do
  :crypto.strong_rand_bytes(16)
  |> Base.encode16(case: :lower)
end
```

#### Rust SDK

```rust
// ✅ GOOD: Uses uuid crate with crypto-secure RNG
// Already implemented
use uuid::Uuid;

fn generate_nonce() -> String {
    Uuid::new_v4().to_string()
}
```

### Signature Verification (v0.4+ Roadmap)

Current v0.3 uses placeholder signatures. Plan for v0.4:

```javascript
// Future v0.4 implementation
const crypto = require('crypto');

function signMessage(message, privateKey) {
  const payload = JSON.stringify({
    type: message.type,
    thread_id: message.thread_id,
    timestamp: message.timestamp,
    nonce: message.nonce,
    payload: message.payload
  });

  const signature = crypto
    .createHmac('sha256', privateKey)
    .update(payload)
    .digest('hex');

  return signature;
}

function verifySignature(message, publicKey) {
  const expectedSig = signMessage(message, publicKey);

  // Use timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(message.signature, 'hex'),
    Buffer.from(expectedSig, 'hex')
  );
}
```

---

## Transport Layer Security

### TLS Configuration

**Mandatory:** Always use TLS 1.3+ in production.

#### Node.js Server

```javascript
const https = require('https');
const fs = require('fs');
const { WebSocketServer } = require('ws');

const server = https.createServer({
  cert: fs.readFileSync('/path/to/cert.pem'),
  key: fs.readFileSync('/path/to/key.pem'),

  // TLS 1.3 only
  minVersion: 'TLSv1.3',

  // Strong cipher suites
  ciphers: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256'
  ].join(':'),

  // Enable OCSP stapling
  requestOCSP: true
});

const wss = new WebSocketServer({ server });
server.listen(8443);
```

#### Nginx Reverse Proxy

```nginx
server {
  listen 443 ssl http2;
  server_name ltp.example.com;

  # TLS 1.3 only
  ssl_protocols TLSv1.3;

  # Strong cipher suites
  ssl_ciphers 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256';
  ssl_prefer_server_ciphers on;

  # Certificates
  ssl_certificate /etc/letsencrypt/live/ltp.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/ltp.example.com/privkey.pem;

  # OCSP stapling
  ssl_stapling on;
  ssl_stapling_verify on;

  # HSTS
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  location / {
    proxy_pass http://localhost:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

### Certificate Validation

```javascript
// Client-side certificate pinning (optional, high security)
const client = new LtpClient('wss://ltp.example.com', {
  clientId: 'secure-client',
  wsOptions: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca-cert.pem'),

    // Certificate pinning (optional)
    checkServerIdentity: (host, cert) => {
      const expectedFingerprint = 'SHA256:ABC123...';
      const actualFingerprint = cert.fingerprint256;

      if (actualFingerprint !== expectedFingerprint) {
        throw new Error('Certificate fingerprint mismatch');
      }
    }
  }
});
```

---

## Authentication & Authorization

### Token-Based Authentication

```javascript
// Server-side token validation
const jwt = require('jsonwebtoken');

async function validateAuthToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      maxAge: '1h'
    });

    return { valid: true, userId: decoded.userId };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// WebSocket connection with auth
wss.on('connection', async (ws, req) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');

  if (!token) {
    ws.close(1008, 'Unauthorized: Missing token');
    return;
  }

  const auth = await validateAuthToken(token);
  if (!auth.valid) {
    ws.close(1008, `Unauthorized: ${auth.error}`);
    return;
  }

  // Store user context
  ws.userId = auth.userId;

  // Continue with LTP handshake...
});
```

### Role-Based Access Control (RBAC)

```javascript
const userPermissions = new Map([
  ['admin', ['read', 'write', 'delete', 'admin']],
  ['user', ['read', 'write']],
  ['readonly', ['read']]
]);

function checkPermission(userId, action) {
  const user = getUserById(userId);
  const permissions = userPermissions.get(user.role) || [];
  return permissions.includes(action);
}

function handleMessage(ws, message) {
  // Check permissions before processing
  if (message.type === 'state_update' && !checkPermission(ws.userId, 'write')) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: {
        error_code: 'FORBIDDEN',
        error_message: 'Insufficient permissions'
      }
    }));
    return;
  }

  // Process message...
}
```

---

## Rate Limiting & DoS Protection

### Per-Client Rate Limiting

Already implemented in example server (v0.3.1+):

```javascript
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_MESSAGES = 100; // 100 msg/min

function checkRateLimit(clientId) {
  const now = Date.now();

  if (!rateLimit.has(clientId)) {
    rateLimit.set(clientId, { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  const limit = rateLimit.get(clientId);

  if (now > limit.resetAt) {
    limit.count = 0;
    limit.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  if (limit.count >= RATE_LIMIT_MAX_MESSAGES) {
    return false; // Rate limit exceeded
  }

  limit.count++;
  return true;
}
```

### Connection Limits

```javascript
const MAX_CONNECTIONS_PER_IP = 10;
const connectionsByIP = new Map();

wss.on('connection', (ws, req) => {
  const clientIP = req.socket.remoteAddress;
  const currentConnections = connectionsByIP.get(clientIP) || 0;

  if (currentConnections >= MAX_CONNECTIONS_PER_IP) {
    ws.close(1008, 'Too many connections from this IP');
    return;
  }

  connectionsByIP.set(clientIP, currentConnections + 1);

  ws.on('close', () => {
    const count = connectionsByIP.get(clientIP) || 0;
    if (count > 0) {
      connectionsByIP.set(clientIP, count - 1);
    }
  });
});
```

### Payload Size Limits

```javascript
const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1 MB

ws.on('message', (data) => {
  if (data.length > MAX_PAYLOAD_SIZE) {
    console.warn(`⚠️  Payload too large: ${data.length} bytes`);
    ws.send(JSON.stringify({
      type: 'error',
      payload: {
        error_code: 'PAYLOAD_TOO_LARGE',
        error_message: `Maximum payload size is ${MAX_PAYLOAD_SIZE} bytes`
      }
    }));
    return;
  }

  // Process message...
});
```

---

## Input Validation

### Message Envelope Validation

```javascript
function validateEnvelope(envelope) {
  // Required fields
  if (!envelope.type || typeof envelope.type !== 'string') {
    return { valid: false, error: 'Missing or invalid type' };
  }

  if (!envelope.thread_id || typeof envelope.thread_id !== 'string') {
    return { valid: false, error: 'Missing or invalid thread_id' };
  }

  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(envelope.thread_id)) {
    return { valid: false, error: 'Invalid thread_id format' };
  }

  // Type whitelist
  const validTypes = ['handshake_init', 'handshake_resume', 'state_update', 'event', 'ping', 'pong'];
  if (!validTypes.includes(envelope.type)) {
    return { valid: false, error: 'Unknown message type' };
  }

  // Timestamp validation
  if (envelope.timestamp && typeof envelope.timestamp === 'number') {
    const now = Math.floor(Date.now() / 1000);
    const drift = Math.abs(now - envelope.timestamp);

    if (drift > 300) { // 5 minutes
      return { valid: false, error: 'Timestamp drift too large' };
    }
  }

  return { valid: true };
}
```

### Payload Sanitization

```javascript
function sanitizePayload(payload) {
  // Remove potentially dangerous fields
  const dangerous = ['__proto__', 'constructor', 'prototype'];

  function sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (!dangerous.includes(key)) {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized;
  }

  return sanitizeObject(payload);
}
```

---

## Replay Attack Prevention

### Nonce Validation

Complete implementation in DEPLOYMENT.md section 4. Key points:

- Store used nonces in cache with TTL (5 minutes)
- Validate timestamp drift (max 1 minute)
- Verify nonce format and client ID match
- Use Redis for distributed deployments

```javascript
const nonceCache = new Map();

function validateNonce(nonce, clientId) {
  const parts = nonce.split('-');
  if (parts.length < 3) {
    return { valid: false, reason: 'Invalid nonce format' };
  }

  const [nonceClientId, timestampStr, randomPart] = parts;

  // Check client ID
  if (nonceClientId !== clientId) {
    return { valid: false, reason: 'Client ID mismatch' };
  }

  // Check timestamp
  const drift = Math.abs(Date.now() - parseInt(timestampStr));
  if (drift > 60000) {
    return { valid: false, reason: 'Timestamp too old' };
  }

  // Check replay
  if (nonceCache.has(nonce)) {
    return { valid: false, reason: 'Replay attack detected' };
  }

  nonceCache.set(nonce, Date.now());
  return { valid: true };
}
```

---

## Session Management

### Secure Thread ID Storage

#### Browser (JavaScript)

```javascript
// Use sessionStorage for ephemeral data
class SecureStorage {
  constructor() {
    this.prefix = 'ltp_secure_';
  }

  setItem(key, value) {
    // Optional: encrypt sensitive data
    const encrypted = this.encrypt(value);
    sessionStorage.setItem(this.prefix + key, encrypted);
  }

  getItem(key) {
    const encrypted = sessionStorage.getItem(this.prefix + key);
    if (!encrypted) return null;
    return this.decrypt(encrypted);
  }

  encrypt(data) {
    // Simple obfuscation (use real encryption in production)
    return btoa(JSON.stringify(data));
  }

  decrypt(data) {
    return JSON.parse(atob(data));
  }
}
```

#### Python

```python
import json
from pathlib import Path
from cryptography.fernet import Fernet

class SecureStorage:
    def __init__(self, key_file=None):
        self.path = Path.home() / '.ltp_client_secure.json'
        self.key_file = key_file or Path.home() / '.ltp_key'
        self.cipher = self._load_or_create_cipher()

    def _load_or_create_cipher(self):
        if self.key_file.exists():
            key = self.key_file.read_bytes()
        else:
            key = Fernet.generate_key()
            self.key_file.write_bytes(key)
            self.key_file.chmod(0o600)  # Owner read/write only

        return Fernet(key)

    def save(self, data):
        encrypted = self.cipher.encrypt(json.dumps(data).encode())
        self.path.write_bytes(encrypted)
        self.path.chmod(0o600)

    def load(self):
        if not self.path.exists():
            return {}

        encrypted = self.path.read_bytes()
        decrypted = self.cipher.decrypt(encrypted)
        return json.loads(decrypted)
```

### Session Expiry

```javascript
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function validateSession(sessionId) {
  const session = sessions.get(sessionId);

  if (!session) {
    return { valid: false, reason: 'Session not found' };
  }

  const age = Date.now() - session.createdAt;
  if (age > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return { valid: false, reason: 'Session expired' };
  }

  // Update last seen
  session.lastSeen = Date.now();

  return { valid: true };
}
```

---

## Monitoring & Logging

### Security Event Logging

```javascript
const securityLogger = {
  logAuthFailure(clientId, reason) {
    console.warn(`[SECURITY] Auth failure: client=${clientId} reason=${reason}`);
    // Send to SIEM/logging service
  },

  logRateLimitExceeded(clientId) {
    console.warn(`[SECURITY] Rate limit exceeded: client=${clientId}`);
  },

  logReplayAttempt(clientId, nonce) {
    console.warn(`[SECURITY] Replay attack: client=${clientId} nonce=${nonce}`);
  },

  logInvalidInput(clientId, error) {
    console.warn(`[SECURITY] Invalid input: client=${clientId} error=${error}`);
  }
};
```

### Metrics Collection

```javascript
const metrics = {
  connections: 0,
  messagesProcessed: 0,
  rateLimitHits: 0,
  authFailures: 0,
  replayAttempts: 0
};

// Expose metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({
    timestamp: Date.now(),
    metrics
  });
});
```

---

## Production Checklist

### Pre-Deployment

- [ ] TLS 1.3+ configured with valid certificates
- [ ] Cryptographically secure random generation enabled (v0.3.1+)
- [ ] Rate limiting implemented and tested
- [ ] Input validation on all message types
- [ ] Authentication mechanism in place
- [ ] Session management configured
- [ ] Connection limits set
- [ ] Payload size limits enforced
- [ ] Error handling does not leak sensitive info
- [ ] Security logging enabled

### Post-Deployment

- [ ] Monitor security logs for anomalies
- [ ] Set up alerts for rate limit violations
- [ ] Regular security audits
- [ ] Keep SDKs and dependencies updated
- [ ] Review access logs weekly
- [ ] Test disaster recovery procedures
- [ ] Document security incident response plan

### Continuous Security

- [ ] Subscribe to security advisories
- [ ] Perform quarterly penetration testing
- [ ] Review and rotate credentials regularly
- [ ] Update TLS certificates before expiry
- [ ] Monitor CVEs for dependencies
- [ ] Conduct security training for team

---

## Security Contacts

For security vulnerabilities, please report to:
- Email: security@liminal.example.com
- Follow responsible disclosure policy in `.github/SECURITY.md`

---

## Version History

- **v0.3.1** (2025-01-17): Enhanced cryptographic security across all SDKs
  - Fixed Math.random() → crypto-secure RNG in JS SDK
  - Added rate limiting to server examples
  - Implemented replay attack protection examples
  - Created security hardening guide

- **v0.3.0**: Initial security framework with placeholder signatures

---

## Additional Resources

- [SECURITY.md](./.github/SECURITY.md) - Security policy and reporting
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment security guide
- [WHITEPAPER.md](./WHITEPAPER.md) - Security roadmap
- [LTP Security Specification](./specs/LTP-core.md#security-considerations)

---

**Remember:** Security is a continuous process, not a one-time setup. Stay vigilant and keep your systems updated.

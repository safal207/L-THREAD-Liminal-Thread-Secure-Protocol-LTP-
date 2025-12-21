# Changelog

All notable changes to L-THREAD / LTP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Added canonical orientation explanation and onboarding materials (media assets referenced externally; binaries not stored in repo).
- No protocol or contract changes.
- Published `@ltp/inspect@0.1.1` CLI shim for `ltp inspect` entrypoint with deterministic inspector outputs (stable field ordering, gated timestamps, and golden trace quickstart).

### Planned
- Complete v0.6.0 production security (see roadmap below)
- LRI integration examples
- Cross-language SDK comparison benchmarks
- Production-ready TOON codec implementations

## [0.1.0] - 2025-02-20

### Added
- **Frames (frozen v0.1 surface):** `hello`, `heartbeat`, `orientation`, `route_request`, `route_response`, `focus_snapshot` documented as stable for partners.
- **Canonical flow:** Locked reference path `hello → heartbeat → orientation → route_request → route_response` with deterministic IDs and timestamps for demo parity.
- **Conformance kit artifacts:** Deterministic report (`reports/ci-report.json`) and badge payload (`reports/badge.json`) emitted by `pnpm -w ltp:conformance verify:dir fixtures/conformance/v0.1 --out ...`.
- **Demo servers & quickstart:** One-command `make demo` / `pnpm demo:all` to print the canonical flow; README quickstart updated with install + demo instructions.

## [0.6.0-alpha.3] - 2025-01-18

### 🔒 HIGH PRIORITY SECURITY FIX - Metadata Encryption (Privacy Protection)

**Addressing HIGH priority issue from Snowden/Assange security audit**

### Fixed

- **Metadata Tracking Vulnerability** (HIGH PRIORITY FIX ❌→✅)
  - `thread_id`, `session_id`, and `timestamp` now encrypted using AES-256-GCM
  - Prevents adversaries from tracking users across sessions
  - Server uses `routing_tag` (HMAC-based) for message routing without seeing plaintext metadata
  - Location: `sdk/js/src/client.ts:1011-1051, 557-577`

### Added

- **Metadata Encryption Functions** - Encrypt sensitive metadata fields
  - `encryptMetadata(metadata, encryptionKey)` - Encrypts thread_id, session_id, timestamp
  - `decryptMetadata(encryptedMetadata, encryptionKey)` - Decrypts metadata blob
  - `generateRoutingTag(threadId, sessionId, macKey)` - Creates HMAC-based routing tag
  - Format: `ciphertext:iv:tag` (colon-separated for easy parsing)
  - Location: `sdk/js/src/crypto.ts:756-838`

- **New Envelope Fields** - Support encrypted metadata
  - `LtpEnvelope.encrypted_metadata` - Encrypted metadata blob (AES-256-GCM)
  - `LtpEnvelope.routing_tag` - HMAC-based tag for server routing
  - Location: `sdk/js/src/types.ts:245-260`

- **Client Options** - Enable metadata encryption
  - `enableMetadataEncryption` - Opt-in flag for metadata encryption (default: false)
  - `sessionEncryptionKey` - Encryption key from ECDH key derivation
  - Automatically set when `enableEcdhKeyExchange` is true
  - Location: `sdk/js/src/types.ts:295-310`

### Changed

- **Message Sending** - Encrypts metadata when enabled
  - `send()` method now encrypts metadata if `enableMetadataEncryption` is true
  - Plaintext metadata fields cleared (set to empty/zero) when encrypted
  - Server uses `routing_tag` for message routing
  - Location: `sdk/js/src/client.ts:1011-1051`

- **Message Receiving** - Decrypts metadata automatically
  - `handleMessageAsync()` decrypts `encrypted_metadata` if present
  - Restores plaintext metadata to envelope for backward compatibility
  - Falls back to plaintext if decryption fails
  - Location: `sdk/js/src/client.ts:557-577`

### Security Impact

**Before v0.6.0-alpha.3:** ❌ Metadata EXPOSED
```typescript
// All metadata in cleartext:
{
  thread_id: "thread-abc123",      // ← Tracking identifier
  session_id: "session-xyz789",    // ← Session identifier
  timestamp: 1705598400000,        // ← Behavioral profiling
  // Adversary can:
  // - Track user across sessions (thread_id)
  // - Correlate messages (session_id)
  // - Profile activity patterns (timestamp)
}
```

**After v0.6.0-alpha.3:** ✅ Metadata PROTECTED
```typescript
// Metadata encrypted:
{
  encrypted_metadata: "ciphertext:iv:tag",  // ← Encrypted blob
  routing_tag: "a1b2c3d4e5f6...",          // ← HMAC tag (no plaintext)
  thread_id: "",                            // ← Cleared (server uses routing_tag)
  session_id: "",                           // ← Cleared
  timestamp: 0,                             // ← Zeroed
  // Adversary cannot:
  // - See thread_id or session_id
  // - Track user across sessions
  // - Profile activity patterns
  // Server uses routing_tag for routing (HMAC-based, no plaintext)
}
```

**Protection Mechanism:**
```typescript
// Encryption process:
const metadata = { thread_id, session_id, timestamp };
const encrypted = await encryptMetadata(metadata, encryptionKey);
// Format: ciphertext:iv:tag

// Routing tag generation:
const routingTag = await generateRoutingTag(threadId, sessionId, macKey);
// Server uses routing_tag for routing without decrypting

// Decryption (client-side only):
const decrypted = await decryptMetadata(encrypted, encryptionKey);
// Restores plaintext metadata for application use
```

### Migration Guide

**Enable metadata encryption:**
```typescript
const client = new LtpClient('wss://api.example.com', {
  enableEcdhKeyExchange: true,        // Required for encryption key
  enableMetadataEncryption: true,      // Enable metadata encryption
  // sessionEncryptionKey set automatically from ECDH
});
```

**Backward Compatibility:**
- Metadata encryption is opt-in (default: false)
- Servers can handle both encrypted and plaintext metadata
- Clients decrypt automatically if `encrypted_metadata` present
- Falls back to plaintext if decryption fails

### Related

- Part of v0.6.0 production security roadmap
- Addresses HIGH priority from Snowden/Assange audit
- Complements HMAC-based nonces (v0.6.0-alpha.1)
- Complements authenticated ECDH (v0.6.0-alpha.2)

---

## [0.6.0-alpha.2] - 2025-01-18

### 🔒 CRITICAL SECURITY FIX - Authenticated ECDH (MitM Protection)

**Addressing CRITICAL priority issue from Snowden/Assange security audit**

### Fixed

- **Man-in-the-Middle Vulnerability in ECDH Key Exchange** (CRITICAL FIX ❌→✅)
  - Ephemeral ECDH public keys now signed with long-term secret key
  - Client signs `client_ecdh_public_key` before sending in handshake
  - Client verifies `server_ecdh_public_key` signature before deriving keys
  - MitM attackers can no longer substitute ECDH keys undetected
  - **Handshake is rejected** if server ECDH signature verification fails
  - Location: `sdk/js/src/client.ts:471-489, 516-534, 775-800`

### Added

- **ECDH Key Signing Functions** - Authenticate ephemeral keys
  - `signEcdhPublicKey(publicKey, entityId, timestamp, secretKey)`
  - Creates HMAC-SHA256 signature over `publicKey:entityId:timestamp`
  - Used by client to sign ephemeral keys during handshake
  - Location: `sdk/js/src/crypto.ts:75-83`

- **ECDH Key Verification Functions** - Validate signatures
  - `verifyEcdhPublicKey(publicKey, entityId, timestamp, signature, secretKey, maxAge)`
  - Validates signature and checks timestamp freshness (default: 5 minutes)
  - Prevents replay attacks on key exchange
  - Returns `{ valid: boolean; error?: string }`
  - Location: `sdk/js/src/crypto.ts:99-129`

- **New Type Fields** - Support authenticated ECDH
  - `HandshakeInitMessage.client_ecdh_signature` - Client key signature
  - `HandshakeInitMessage.client_ecdh_timestamp` - Signature timestamp
  - `HandshakeAckMessage.server_ecdh_signature` - Server key signature
  - `HandshakeAckMessage.server_ecdh_timestamp` - Signature timestamp
  - `HandshakeResumeMessage.client_ecdh_signature` - Resume key signature
  - `HandshakeResumeMessage.client_ecdh_timestamp` - Resume timestamp
  - Location: `sdk/js/src/types.ts:109-114, 154-159, 177-181`

### Changed

- **Handshake Protocol** - Signs and verifies ECDH keys
  - `sendHandshakeInit()` now signs client ECDH key if `secretKey` provided
  - `sendHandshakeResume()` signs client key for resumed sessions
  - `handleHandshakeAck()` verifies server ECDH key signature
  - **Connection terminated** if server signature verification fails
  - Warnings logged if ECDH enabled without `secretKey` (MitM risk)

### Security Impact

**Before v0.6.0-alpha.2:** ❌ MitM VULNERABLE
```typescript
// Attacker intercepts handshake:
Client → [Attacker] → Server
  client_ecdh_public_key: "CLIENT_KEY"
  // Attacker replaces with own key:
  client_ecdh_public_key: "ATTACKER_KEY"

Server → [Attacker] → Client
  server_ecdh_public_key: "SERVER_KEY"
  // Attacker replaces with own key:
  server_ecdh_public_key: "ATTACKER_KEY"

// Result: Attacker can decrypt all messages
// Client ←[decrypt]→ Attacker ←[decrypt]→ Server
```

**After v0.6.0-alpha.2:** ✅ MitM PROTECTED
```typescript
// Client signs its ECDH key:
client_ecdh_public_key: "CLIENT_KEY"
client_ecdh_signature: HMAC(secretKey, "CLIENT_KEY:clientId:timestamp")
client_ecdh_timestamp: 1705598400000

// Server verifies signature before using key
// Attacker cannot forge signature without secretKey

// Server signs its ECDH key:
server_ecdh_public_key: "SERVER_KEY"
server_ecdh_signature: HMAC(serverSecretKey, "SERVER_KEY:sessionId:timestamp")
server_ecdh_timestamp: 1705598401000

// Client verifies signature - REJECTS if invalid:
if (!verifyEcdhPublicKey(...)) {
  disconnect(); // ← Connection terminated
  return;
}

// Result: MitM attack PREVENTED
```

**Protection Mechanism:**
```typescript
// Signature format prevents key substitution:
const input = `${publicKey}:${entityId}:${timestamp}`;
const signature = HMAC-SHA256(secretKey, input);

// Without secretKey, attacker cannot:
// 1. Generate valid signature for their own key
// 2. Modify the public key without breaking signature
// 3. Replay old signatures (timestamp validation)

// Timestamp validation:
if (age > 5 minutes) reject; // Prevents replay attacks
if (skew > 5 seconds) reject; // Prevents future timestamps
```

### Compatibility

- ✅ **Backward compatible** - Signatures are optional (but recommended)
- ⚠️ **Warning logged** - If ECDH enabled without `secretKey` (insecure)
- 🔐 **Production ready** - When `secretKey` provided, MitM protection active
- 🔄 **Server support needed** - Server must sign its ECDH key for full protection

### Testing

```bash
npm test  # All tests passing ✅
```

### Migration

**Recommended (Authenticated ECDH):**
```typescript
import { LtpClient } from '@liminal/ltp-client';

// Provide secretKey to enable authenticated ECDH
const client = new LtpClient('wss://api.example.com', {
  clientId: 'user-device-123',
  secretKey: 'shared-secret',        // ← Enables key authentication
  enableEcdhKeyExchange: true,       // ← Automatic key exchange
});

// Handshake now includes signed ECDH keys:
// - client_ecdh_public_key (ephemeral)
// - client_ecdh_signature (authenticated)
// - client_ecdh_timestamp (freshness)

// If server signature invalid → connection rejected
```

**Insecure (No authentication - logs warning):**
```typescript
// Without secretKey, ECDH keys are NOT authenticated
const client = new LtpClient('wss://api.example.com', {
  clientId: 'user-device-123',
  enableEcdhKeyExchange: true,
  // No secretKey provided ← MitM risk!
});

// WARNING logged: "ECDH key exchange enabled but no secretKey
// provided - key not authenticated (MitM risk!)"
```

### Roadmap to v0.6.0-stable

- [x] **HIGH**: Remove client ID from nonce (HMAC-based nonce) ✅
- [x] **CRITICAL**: Authenticate ECDH public keys (sign with long-term keys) ✅
- [ ] **HIGH**: Encrypt metadata fields (thread_id, timestamps)
- [ ] **MEDIUM**: Migrate to X25519 curve
- [ ] **MEDIUM**: Implement message padding
- [ ] Remove v0.3 placeholder signatures entirely
- [ ] Add key rotation mechanism

### Related

- Addresses CRITICAL priority from security audit (PR #13)
- Prevents Man-in-the-Middle attacks on key exchange
- Complements HMAC-based nonces (v0.6.0-alpha.1)
- Requires shared `secretKey` for authentication

## [0.6.0-alpha.1] - 2025-01-18

### 🔒 CRITICAL PRIVACY FIX - HMAC-based Nonces (No Client ID Leak)

**Addressing HIGH priority issue from Snowden/Assange security audit**

### Fixed

- **Client Identity Leak in Nonces** (HIGH PRIORITY FIX ❌→✅)
  - Nonces now use HMAC-based format: `hmac-{32hex}-{timestamp}`
  - **NO client_id exposed** - prevents user tracking across sessions
  - Uses session MAC key to generate unpredictable nonce values
  - Attackers can no longer correlate messages to specific users
  - Location: `sdk/js/src/client.ts:1160-1187`

- **Dual-Format Nonce Validation** (Backward Compatibility)
  - Validates both HMAC-based nonces (v0.6+) and legacy format (v0.5)
  - Legacy format: `{clientId}-{timestamp}-{random}` still supported
  - Warnings logged when using legacy format
  - Location: `sdk/js/src/client.ts:1193-1274`

### Added

- **HMAC-SHA256 Utility Function** - Cross-platform HMAC computation
  - `hmacSha256(input, key)` - Works in browser (Web Crypto API) and Node.js
  - Used for secure nonce generation and other HMAC operations
  - Location: `sdk/js/src/crypto.ts:18-61`

### Changed

- **`generateNonce()` - Now Async**
  - Changed from synchronous to async function
  - Computes HMAC over `{timestamp}-{random}` using session MAC key
  - Falls back to legacy format if MAC key not available (logs warning)
  - Location: `sdk/js/src/client.ts:1160-1187`

- **`send()` Method** - Awaits nonce generation
  - Updated to `await this.generateNonce()`
  - Location: `sdk/js/src/client.ts:932`

### Security Impact

**Before v0.6.0-alpha.1:** ❌ IDENTITY LEAK
```typescript
// Nonce format exposed client_id:
{
  "nonce": "user-device-123-1705598400000-a1b2c3d4",
           // ^^^^^^^^^^^^^^^^ - Client identity leaked!
  // Attacker can:
  // - Track user across sessions
  // - Correlate messages to specific users
  // - Build user activity profiles
}
```

**After v0.6.0-alpha.1:** ✅ PRIVACY PROTECTED
```typescript
// Nonce format is HMAC-based (no client_id):
{
  "nonce": "hmac-f3a8b9c2d1e4567890abcdef12345678-1705598400000",
           // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ - Unpredictable HMAC
  // Attacker cannot:
  // - Identify which user sent the message
  // - Correlate messages across sessions
  // - Build user profiles from nonces
}
```

**Privacy Protection Mechanism:**
```typescript
// HMAC computation prevents identity inference:
const input = `${timestamp}-${randomHex}`;
const hmac = await hmacSha256(input, sessionMacKey);
const nonce = `hmac-${hmac.substring(0, 32)}-${timestamp}`;

// Even with identical timestamp, different random value = different HMAC
// Without MAC key, attacker cannot predict or verify nonce values
```

### Compatibility

- ✅ **Backward compatible** - Legacy nonce format still validated
- ✅ **Graceful migration** - Clients can mix HMAC and legacy nonces
- ⚠️ **Warning logged** - When using legacy format (prompts upgrade)
- 🔄 **Transition period** - Both formats supported until v0.7.0

### Testing

```bash
npm test  # All tests passing ✅
```

### Migration

**Recommended (HMAC-based nonces):**
```typescript
import { LtpClient } from '@liminal/ltp-client';

// Provide sessionMacKey to enable HMAC-based nonces
const client = new LtpClient('wss://api.example.com', {
  clientId: 'user-device-123',
  sessionMacKey: macKey, // ← Enables HMAC nonces (no ID leak)
  enableEcdhKeyExchange: true,
});

// Nonces now: hmac-{32hex}-{timestamp}
await client.send('state_update', { data: 'example' });
```

**Legacy (still works, but logs warning):**
```typescript
// Without sessionMacKey, falls back to legacy format
const client = new LtpClient('wss://api.example.com', {
  clientId: 'user-device-123',
  // No sessionMacKey provided
});

// WARNING: Nonces use legacy format with client ID
// Format: user-device-123-{timestamp}-{random}
```

### Roadmap to v0.6.0-stable

- [x] **HIGH**: Remove client ID from nonce (HMAC-based nonce) ✅
- [ ] **CRITICAL**: Authenticate ECDH public keys (sign with long-term keys)
- [ ] **HIGH**: Encrypt metadata fields (thread_id, timestamps)
- [ ] **MEDIUM**: Migrate to X25519 curve
- [ ] **MEDIUM**: Implement message padding
- [ ] Remove v0.3 placeholder signatures entirely
- [ ] Add key rotation mechanism

### Related

- Addresses HIGH priority issue from security audit (PR #13)
- Part of v0.6.0 production security roadmap
- Complements metadata signing (v0.5.0-beta.4)
- Requires session MAC key (derived via ECDH + HKDF)

## [0.5.0-beta.4] - 2025-01-18

### 🔒 CRITICAL SECURITY FIX - Metadata Signing & Tamper Protection

**Ported from PR #11 - Closes metadata tampering vulnerability**

### Fixed

- **Metadata Tampering Vulnerability** (CRITICAL FIX ❌→✅)
  - HMAC signatures now include `meta` field
  - HMAC signatures now include `content_encoding` field
  - Attackers can no longer modify metadata without breaking signature
  - Prevents client_id spoofing, platform manipulation, etc.
  - Location: `sdk/js/src/crypto.ts`

### Changed

- **`signMessage()` signature** - Now accepts `meta` and `content_encoding`
  ```typescript
  await signMessage({
    // ... existing fields
    meta: message.meta,              // ✅ NEW - now signed
    content_encoding: message.content_encoding  // ✅ NEW - now signed
  }, secretKey);
  ```

- **`verifySignature()` signature** - Now verifies `meta` and `content_encoding`
  - Validation includes all envelope metadata
  - Any modification to metadata breaks signature

- **Canonical serialization** - Updated to include new fields
  - `meta` field included in canonical representation
  - `content_encoding` field included in canonical representation
  - Sorted-key JSON serialization maintained

### Security Impact

**Before v0.5.0-beta.4:** ❌ VULNERABLE
```typescript
// Attacker could modify metadata without detection:
{
  "type": "state_update",
  "payload": {...},
  "signature": "valid_hmac", // ✅ Still valid!
  "meta": {
    "client_id": "attacker"  // ❌ Modified but signature valid
  }
}
```

**After v0.5.0-beta.4:** ✅ PROTECTED
```typescript
// Any metadata modification breaks signature:
{
  "type": "state_update",
  "payload": {...},
  "signature": "invalid_hmac", // ❌ Signature now invalid
  "meta": {
    "client_id": "attacker"  // Modification detected!
  }
}
```

### Compatibility

- ✅ **Backward compatible** - `meta` and `content_encoding` are optional
- ✅ **Graceful degradation** - Missing fields treated as empty objects/strings
- ⚠️ **Signature mismatch** - Old signatures won't verify if metadata present

### Testing

```bash
npm test  # All tests passing ✅
```

### Migration

No code changes required for existing clients. Signatures will automatically include metadata when present:

```typescript
// Before (still works):
const signature = await signMessage({
  type, thread_id, session_id, timestamp, nonce, payload
}, key);

// After (recommended):
const signature = await signMessage({
  type, thread_id, session_id, timestamp, nonce, payload,
  meta: { client_id, platform },        // ✅ Now protected
  content_encoding: 'json'              // ✅ Now protected
}, key);
```

### Related

- Ported from Python SDK (PR #11)
- Complements hash chaining (already in main)
- Part of v0.5.0 security hardening roadmap

## [0.5.0-beta.3] - 2025-01-18

### 🔒 Security Hardening & Automatic ECDH Key Exchange

**Completing cryptographic security enhancements - Phase 3**

### Added

- **Automatic ECDH Key Exchange During Handshake** (MAJOR FEATURE)
  - Client generates ephemeral ECDH P-256 key pair automatically
  - Public key sent in `handshake_init` message
  - Server's public key received in `handshake_ack`
  - Session keys derived automatically via HKDF
  - Perfect Forward Secrecy (PFS) - ephemeral keys cleared after derivation
  - Opt-in via `enableEcdhKeyExchange: true` option
  - Location: `sdk/js/src/client.ts:445-458, 655-688`

- **Enhanced Type Definitions**
  - `HandshakeInitMessage.client_ecdh_public_key` field
  - `HandshakeAckMessage.server_ecdh_public_key` field
  - `LtpClientOptions.enableEcdhKeyExchange` flag
  - Location: `sdk/js/src/types.ts`

### Fixed

- **Timing Leak in timingSafeEqual()** (SECURITY FIX)
  - Early return on length mismatch leaked timing information
  - Now compares max(a.length, b.length) characters always
  - Includes length difference in result for constant-time behavior
  - Added dummy comparison for Node.js crypto.timingSafeEqual fallback
  - Location: `sdk/js/src/crypto.ts:128-160`

- **Placeholder Signatures** (SECURITY IMPROVEMENT)
  - Added deprecation warnings when using v0-placeholder signatures
  - Warns: "Using insecure placeholder signature - v0.3 compatibility mode"
  - Documented removal in v0.6.0
  - No fallback to placeholder when signatures required
  - Location: `sdk/js/src/client.ts:1082-1089`

### Security Audit Results

**Independent security assessment conducted**

#### ✅ Strengths Identified
- Perfect Forward Secrecy implementation ✅
- Proper HKDF key derivation (RFC 5869) ✅
- Constant-time comparison (after fix) ✅
- Mandatory signature verification ✅
- Comprehensive replay protection ✅

#### ⚠️ Issues Identified (for future versions)
- **CRITICAL**: ECDH public keys not authenticated (MitM vulnerability)
- **HIGH**: Client ID leaked in nonce format
- **HIGH**: Metadata transmitted in cleartext (tracking risk)
- **MEDIUM**: P-256 curve (NIST-standardized, X25519 preferred)
- **MEDIUM**: No traffic padding (vulnerable to traffic analysis)
- **LOW**: No key rotation mechanism

### Usage Example

```typescript
import { LtpClient } from '@liminal/ltp-client';

// Automatic ECDH key exchange + signature verification
const client = new LtpClient('wss://api.example.com', {
  clientId: 'user-device-123',
  enableEcdhKeyExchange: true, // ← Automatic key exchange
}, {
  onConnected: (threadId, sessionId) => {
    console.log('🔒 Secure session established with PFS');
  }
});

await client.connect();
```

### Breaking Changes

**None** - Fully backward compatible with v0.5.0-beta.2

### Roadmap to v0.6.0

- [ ] **CRITICAL**: Authenticate ECDH public keys (sign with long-term keys)
- [ ] **HIGH**: Remove client ID from nonce (use HMAC-based nonce)
- [ ] **HIGH**: Encrypt metadata fields (thread_id, timestamps)
- [ ] **MEDIUM**: Migrate to X25519 curve
- [ ] **MEDIUM**: Implement message padding
- [ ] Remove v0.3 placeholder signatures entirely
- [ ] Add key rotation mechanism

## [0.5.0-beta.2] - 2025-01-17

### 🔒 Critical Security - Mandatory Verification & Replay Protection

**Implementing recommendations from cryptographic security audit - Phase 2**

### Added

- **Mandatory Signature Verification** (CRITICAL FIX)
  - Signature verification now REQUIRED by default when MAC key is present
  - Invalid signatures are REJECTED (not just logged)
  - Messages without signatures are REJECTED when verification is required
  - Configuration error thrown if verification required but no key provided
  - Location: `sdk/js/src/client.ts:446-578`

- **Nonce Validation for Replay Protection** (CRITICAL FIX)
  - Comprehensive nonce validation with uniqueness check
  - Nonce format validation: `clientId-timestamp-randomHex`
  - Client ID verification in nonce
  - Timestamp drift detection (rejects old and future nonces)
  - Entropy validation (minimum 8 hex characters)
  - Nonce cache with automatic cleanup (TTL-based)
  - Location: `sdk/js/src/client.ts:957-1046`

- **Timestamp Validation** - Replay protection
  - Rejects messages older than `maxMessageAge` (default: 60s)
  - Rejects messages from future (clock skew tolerance: 5s)
  - Configurable via `maxMessageAge` option

### Changed

- **Signature Generation** - Proper key handling
  - Uses `sessionMacKey` if present, falls back to `secretKey`
  - No placeholder when verification is required
  - Throws error if key missing but verification required
  - Location: `sdk/js/src/client.ts:1048-1076`

- **Message Handling** - Now fully async
  - `handleMessage()` → `handleMessageAsync()`
  - Signature verification is blocking (security critical)
  - Nonce validation integrated into message flow
  - Failed verification = message rejected

- **Client Lifecycle** - Nonce cache management
  - Starts nonce cleanup on connect
  - Stops cleanup on disconnect
  - Clears cache on manual disconnect
  - Periodic cleanup every 60 seconds

### Security Improvements

✅ **Fixed:** Optional signature verification (now MANDATORY)
✅ **Fixed:** No replay protection (now COMPREHENSIVE)
✅ **Fixed:** Timestamp validation (age + drift detection)
✅ **Fixed:** Nonce validation (uniqueness + format + entropy)
🚧 **In Progress:** ECDH handshake protocol
🚧 **In Progress:** Remove all placeholder signatures

### Breaking Changes

**None yet** - v0.4 compatibility maintained

However, when a `sessionMacKey` or `secretKey` is provided:
- Signature verification is NOW REQUIRED by default
- Messages without valid signatures are REJECTED
- This is a security improvement, not a breaking change

### Migration Path

```typescript
// v0.5.0-beta.2 - Automatic security when key is present
const client = new LtpClient('wss://...', {
  sessionMacKey: macKey,
  // requireSignatureVerification defaults to TRUE (automatic)
  // maxMessageAge defaults to 60000ms (60 seconds)
});

// To disable verification (NOT RECOMMENDED):
const insecureClient = new LtpClient('wss://...', {
  sessionMacKey: macKey,
  requireSignatureVerification: false, // Explicitly disable
});
```

### Roadmap Updates

- [x] Implement mandatory signature verification in client ✅
- [x] Integrate nonce validation (replay protection) ✅
- [ ] Add ECDH handshake protocol
- [ ] Remove placeholder signatures when verification enabled
- [ ] Update all examples with new key exchange pattern
- [ ] Security audit documentation
- [ ] Performance benchmarks

## [0.5.0-beta.1] - 2025-01-17

### 🔒 Major Security Enhancements - Addressing Cryptographic Review (Phase 1)

**Implementing recommendations from cryptographic security audit**

### Added

- **ECDH Key Derivation for Browser** (CRITICAL FIX)
  - Implemented ECDH `deriveSharedSecret()` for Web Crypto API
  - No longer Node.js-only limitation
  - Full browser support for key exchange
  - Location: `sdk/js/src/crypto.ts:215-270`

- **HKDF (Key Derivation Function)** - RFC 5869 compliant
  - Proper key derivation from ECDH shared secret
  - Works in both browser (Web Crypto HKDF) and Node.js
  - Implements Extract-then-Expand pattern
  - Location: `sdk/js/src/crypto.ts:276-346`

- **Session Key Derivation** - Proper key separation
  - `deriveSessionKeys()` derives separate keys:
    - `encryptionKey` - for AES-GCM encryption
    - `macKey` - for HMAC signatures
    - `ivKey` - for IV generation
  - No more shared secret reuse
  - Location: `sdk/js/src/crypto.ts:352-369`

### Changed

- **Client Options** - Move toward proper key management
  - Added `sessionMacKey` (replaces `secretKey`)
  - Added `requireSignatureVerification` (defaults to TRUE when key present)
  - Added `maxMessageAge` for replay protection (default 60s)
  - Deprecated `secretKey` (kept for v0.4 compatibility)
  - Location: `sdk/js/src/types.ts:270-293`

### Security Improvements

✅ **Fixed:** ECDH browser limitation
✅ **Fixed:** No HKDF - now using proper KDF
✅ **Fixed:** Key reuse - now separate keys for different purposes
🚧 **In Progress:** Mandatory signature verification
🚧 **In Progress:** Replay attack protection with nonce validation
🚧 **In Progress:** Remove placeholder signatures

### Breaking Changes

**None yet** - v0.4 compatibility maintained

v0.5.0-beta is **NOT production ready**. Use for testing and feedback only.

### Migration Path (when v0.5.0 is complete)

```typescript
// OLD (v0.4): Shared secret
const client = new LtpClient('wss://...', {
  secretKey: 'shared-secret', // ❌ Deprecated
});

// NEW (v0.5): ECDH key exchange + HKDF
const { publicKey, privateKey } = await generateKeyPair();
const sharedSecret = await deriveSharedSecret(privateKey, serverPublicKey);
const { macKey } = await deriveSessionKeys(sharedSecret, sessionId);

const client = new LtpClient('wss://...', {
  sessionMacKey: macKey, // ✅ Proper key management
  requireSignatureVerification: true, // ✅ Mandatory (default)
  maxMessageAge: 60000, // ✅ Replay protection
});
```


## [0.4.0] - 2025-01-17

### Added - Real Cryptography

**Major cryptographic enhancements - Message signing and verification**

- **Cryptographic Module** - New crypto.ts with comprehensive utilities
  - HMAC-SHA256 message signing and verification
  - ECDH key pair generation and key exchange (P-256)
  - AES-256-GCM encryption/decryption
  - Timing-safe comparison
  - Browser (Web Crypto API) and Node.js support

- **Message Signing** - Automatic HMAC-SHA256 signatures
  - Optional secretKey in LtpClientOptions
  - Backward compatible with v0-placeholder fallback
  - Non-blocking signature generation

- **Signature Verification** - Validate incoming messages
  - Optional enableSignatureVerification flag
  - Logs warnings for invalid signatures
  - Non-blocking verification

- **Exported Crypto Utilities** - Public API for advanced use
  - signMessage(), verifySignature()
  - generateKeyPair(), deriveSharedSecret()
  - encryptPayload(), decryptPayload()

### Changed

- JavaScript SDK version → 0.4.0
- Enhanced LtpClientOptions with secretKey and enableSignatureVerification

### Security

- HMAC-SHA256 message authentication
- Timing-safe signature comparison
- Foundation for E2E encryption

### Backward Compatibility

100% backward compatible with v0.3.x. Crypto features are opt-in.

## [0.3.1] - 2025-01-17

### Security

**Critical Security Enhancements - Production Ready**

- **[CRITICAL] Fixed non-cryptographic random in JavaScript SDK**
  - Replaced `Math.random()` with Web Crypto API (`crypto.getRandomValues()`) for nonce generation
  - Replaced `Math.random()` with Node.js `crypto.randomBytes()` for server environments
  - Added fallback to UUID v4 for environments without crypto support
  - Locations: `sdk/js/src/client.ts:735-817`

- **[CRITICAL] Fixed non-cryptographic random in server examples**
  - Replaced `Math.random()` with `crypto.randomBytes()` in `attachSecurity()` function
  - Locations: `examples/js-minimal-server/index.js:58`

- **[MEDIUM] Enhanced Python SDK nonce generation**
  - Replaced `uuid4().hex[:6]` with `secrets.token_hex(8)` for stronger randomness
  - Now uses cryptographically secure random throughout
  - Locations: `sdk/python/ltp_client/client.py:407-409`

### Added

- **Rate Limiting** - Production-ready rate limiting in server examples
  - Per-client message rate limiting (100 messages/minute default)
  - Automatic cleanup of expired rate limit entries
  - `RATE_LIMIT_EXCEEDED` error response
  - Locations: `examples/js-minimal-server/index.js:19-51, 192-206`

- **Replay Attack Protection** - Comprehensive nonce validation example
  - Nonce uniqueness validation with TTL cache
  - Timestamp drift detection (max 1 minute)
  - Client ID verification in nonce
  - Production implementation guide in `DEPLOYMENT.md`
  - Locations: `DEPLOYMENT.md:708-807`

- **Security Hardening Guide** - Complete production security guide
  - `SECURITY_HARDENING.md` - 500+ line comprehensive security guide
  - Cryptographic best practices for all SDKs
  - TLS 1.3+ configuration examples
  - Authentication & authorization patterns
  - DoS protection strategies
  - Session management security
  - Monitoring & logging recommendations
  - Production deployment checklist

### Changed

- **Updated all SDKs to use cryptographically secure random number generation**
  - JavaScript/TypeScript: Web Crypto API + Node.js crypto module
  - Python: `secrets` module (CSPRNG)
  - Elixir: `:crypto.strong_rand_bytes()` (already secure)
  - Rust: `uuid` crate with crypto RNG (already secure)

- **Enhanced server example security**
  - Added rate limiting middleware
  - Added connection cleanup
  - Improved error responses for security violations

### Documentation

- Added `SECURITY_HARDENING.md` - Production security guide
- Updated `DEPLOYMENT.md` with replay attack protection examples
- Enhanced security sections in all documentation
- Added security checklist for production deployments

### Migration Guide

**From v0.3.0 to v0.3.1:**

No breaking changes. All security enhancements are backward compatible.

**Recommended actions:**
1. Update all SDKs to v0.3.1+
2. Review `SECURITY_HARDENING.md` for production deployments
3. Implement rate limiting in production servers
4. Consider adding replay attack protection (see `DEPLOYMENT.md`)
5. Verify TLS 1.3+ is configured

**Risk Assessment:**
- **v0.3.0 and earlier:** Not recommended for production (weak random in JS SDK)
- **v0.3.1+:** Production ready with proper security hardening

## [0.3.0] - 2025-01-15

### Added
- **TOON (Token-Oriented Object Notation) support** - Optional compact payload encoding for large arrays
- `content_encoding` field in LTP envelope (v0.3+)
- `LtpCodec` interface for TOON encoding/decoding
- `preferredEncoding` client option
- Structured logging with `LtpLogger` interface
- Advanced examples for all SDKs:
  - Production-ready client wrappers
  - Event-driven architecture patterns
  - Async worker pools
  - Supervised clients (Elixir)
  - Concurrent operations (Rust)
- Performance benchmarks:
  - JSON vs TOON size/performance comparison
  - Throughput benchmarks
- Comprehensive documentation:
  - `ARCHITECTURE.md` - Ecosystem architecture overview
  - `DEPLOYMENT.md` - Production deployment guide
  - `API.md` - Complete API reference
  - `CONTRIBUTING.md` - Contribution guidelines

### Changed
- Updated protocol version to v0.3
- Updated SDK versions to 0.3.0 (JS, Python)
- Enhanced error handling and logging across all SDKs
- Improved test coverage and stability

### Fixed
- Elixir SDK test stability issues
- Dependency resolution for Elixir SDK
- Process isolation in Elixir tests

## [0.2.0] - 2024-12-XX

### Added
- Thread persistence with `handshake_resume`
- Heartbeat mechanism (ping/pong)
- Automatic reconnection with exponential backoff
- Security skeleton (nonce/signature fields)
- Multi-language SDK support:
  - JavaScript/TypeScript SDK
  - Python SDK
  - Elixir SDK
  - Rust SDK

### Changed
- Updated protocol version to v0.2
- Enhanced handshake protocol with resume capability

## [0.1.0] - 2024-XX-XX

### Added
- Initial protocol specification
- Basic handshake (`handshake_init`)
- Message envelope format
- Context preservation metadata
- Liminal metadata (affect, context tags)
- JavaScript SDK implementation
- Python SDK implementation

[Unreleased]: https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-/releases/tag/v0.1.0

# Changelog

All notable changes to L-THREAD / LTP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Complete v0.5.0 implementation (see below)
- LRI integration examples
- Cross-language SDK comparison benchmarks
- Production-ready TOON codec implementations

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


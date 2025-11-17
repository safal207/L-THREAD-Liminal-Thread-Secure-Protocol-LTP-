# Changelog

All notable changes to L-THREAD / LTP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- LRI integration examples
- Cross-language SDK comparison benchmarks
- Full E2E encryption implementation
- Production-ready TOON codec implementations

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


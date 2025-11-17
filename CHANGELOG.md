# Changelog

All notable changes to L-THREAD / LTP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- LRI integration examples
- Advanced authentication/authorization
- Production-ready TOON codec implementations
- Cross-language SDK comparison benchmarks

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


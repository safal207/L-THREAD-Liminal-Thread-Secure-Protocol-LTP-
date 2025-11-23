# 🧪 LTP Protocol Cross-SDK Testing

**Purpose:** Verify that all SDKs (JS, Python, Elixir, Rust) can communicate correctly with each other and implement security features identically.

## 📋 Test Categories

### 1. Cross-SDK Compatibility Tests
- **JS ↔ Python** - Verify handshake, message exchange, security features
- **JS ↔ Elixir** - Verify handshake, message exchange, security features  
- **JS ↔ Rust** - Verify handshake, message exchange, security features
- **Python ↔ Elixir** - Verify handshake, message exchange, security features
- **Python ↔ Rust** - Verify handshake, message exchange, security features
- **Elixir ↔ Rust** - Verify handshake, message exchange, security features

### 2. Security Feature Tests
- **ECDH Key Exchange** - Verify all SDKs derive same session keys
- **Authenticated ECDH** - Verify signature generation/verification works across SDKs
- **HMAC-based Nonces** - Verify nonce format and validation
- **Metadata Encryption** - Verify encryption/decryption compatibility
- **Hash Chaining** - Verify hash chain verification across SDKs

### 3. Protocol Compliance Tests
- **Handshake Flow** - Verify all SDKs follow same handshake protocol
- **Message Format** - Verify message serialization/deserialization
- **Error Handling** - Verify consistent error responses

## 🚀 Running Tests

### Prerequisites
- Node.js 18+ (for JS SDK)
- Python 3.9+ (for Python SDK)
- Elixir 1.14+ (for Elixir SDK)
- Rust stable (for Rust SDK)
- LTP Test Server running (for integration tests)

### Run All Tests
```bash
# Run all cross-SDK compatibility tests
npm run test:cross-sdk

# Verify that all SDKs expose identical core types
node tests/cross-sdk/verify-types.js

# Run security feature tests
npm run test:security

# Run protocol compliance tests
npm run test:protocol
```

### Run Individual SDK Tests
```bash
# JavaScript SDK
cd sdk/js && npm test

# Python SDK
cd sdk/python && pytest tests/

# Elixir SDK
cd sdk/elixir && mix test

# Rust SDK
cd sdk/rust/ltp-client && cargo test
```

## 📝 Test Structure

```
tests/
├── cross-sdk/
│   ├── verify-types.js          # ✅ Type consistency checker (runs in CI)
│   ├── js-python.test.js
│   ├── js-elixir.test.js
│   ├── js-rust.test.js
│   ├── python-elixir.test.py
│   ├── python-rust.test.py
│   └── elixir-rust.test.exs
├── security/
│   ├── ecdh.test.js
│   ├── authenticated-ecdh.test.js
│   ├── hmac-nonces.test.js
│   ├── metadata-encryption.test.js
│   └── hash-chaining.test.js
└── protocol/
    ├── handshake.test.js
    ├── messages.test.js
    └── errors.test.js
```

## 🔄 CI/CD Integration

The `verify-types.js` script is automatically run in GitHub Actions before all SDK tests. This ensures that any type mismatches are caught early in the CI pipeline.

**CI Workflow:**
1. ✅ **verify-types** - Runs first to check type consistency
2. ✅ **test-js** - Depends on verify-types
3. ✅ **test-python** - Depends on verify-types
4. ✅ **test-elixir** - Depends on verify-types
5. ✅ **test-rust** - Depends on verify-types

If type verification fails, all SDK tests are skipped to save CI resources.

## 🔍 Test Coverage Goals

- **Cross-SDK Compatibility:** 100% of SDK pairs tested
- **Security Features:** 100% of features tested across all SDKs
- **Protocol Compliance:** 100% of protocol features tested

---

**Status:** 🚧 In Development  
**Last Updated:** 2025-01-19


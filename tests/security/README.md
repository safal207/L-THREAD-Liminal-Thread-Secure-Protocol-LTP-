# 🔒 Security Feature Tests

**Purpose:** Verify that all security features work correctly across all SDKs (JS, Python, Elixir, Rust).

## 📋 Test Coverage

### ✅ Implemented Tests

1. **ECDH Key Exchange** (`test_ecdh.js`)
   - Verifies that JS and Python can derive the same shared secret
   - Tests cross-SDK key exchange compatibility

2. **Authenticated ECDH** (`test_authenticated_ecdh.js`)
   - Tests signature generation and verification
   - Verifies cross-SDK signature compatibility
   - Tests rejection of invalid signatures

3. **HMAC-based Nonces** (`test_hmac_nonces.js`)
   - Verifies nonce format (64 hex characters)
   - Tests deterministic nonce generation
   - Tests nonce uniqueness with different inputs

4. **Metadata Encryption** (`test_metadata_encryption.js`)
   - Tests encryption/decryption cycle
   - Verifies cross-SDK encryption compatibility
   - Tests rejection of tampered/wrong-key data

5. **Hash Chaining** (`test_hash_chaining.js`)
   - Tests hash generation and verification
   - Verifies cross-SDK hash compatibility
   - Tests tampering detection

## 🚀 Running Tests

### Prerequisites

- Node.js 18+ (for test runner)
- Python 3.9+ (for Python SDK CLI tools)
- JS SDK built (`cd sdk/js && npm install && npm run build`)

### Run All Tests

```bash
# From project root
node tests/security/run_all.js
```

### Run Individual Tests

```bash
# ECDH Key Exchange
node tests/security/test_ecdh.js

# Authenticated ECDH
node tests/security/test_authenticated_ecdh.js

# HMAC-based Nonces
node tests/security/test_hmac_nonces.js

# Metadata Encryption
node tests/security/test_metadata_encryption.js

# Hash Chaining
node tests/security/test_hash_chaining.js
```

## 📝 Test Structure

```
tests/security/
├── README.md                          # This file
├── run_all.js                         # Main test runner
├── test_ecdh.js                       # ECDH key exchange tests
├── test_authenticated_ecdh.js         # Authenticated ECDH tests
├── test_hmac_nonces.js                 # HMAC nonce tests
├── test_metadata_encryption.js         # Metadata encryption tests
├── test_hash_chaining.js               # Hash chaining tests
├── ecdh_cli.py                         # Python CLI for ECDH
├── authenticated_ecdh_cli.py           # Python CLI for authenticated ECDH
├── hmac_nonces_cli.py                  # Python CLI for HMAC nonces
├── metadata_encryption_cli.py           # Python CLI for metadata encryption
└── hash_chaining_cli.py                 # Python CLI for hash chaining
```

## 🔍 How Tests Work

Each test follows this pattern:

1. **JS SDK** performs an operation (generate key, encrypt, etc.)
2. **Python SDK** performs the same operation
3. **Cross-SDK verification** - JS verifies Python's output and vice versa
4. **Error cases** - Tests rejection of invalid/tampered data

This ensures that:
- All SDKs implement the same cryptographic algorithms
- Cross-SDK communication works correctly
- Security features are properly implemented

## 🎯 Future Enhancements

- [ ] Add Elixir SDK CLI tools
- [ ] Add Rust SDK CLI tools
- [ ] Add performance benchmarks
- [ ] Add fuzzing tests
- [ ] Add integration with CI/CD

---

**Status:** ✅ Core tests implemented (JS ↔ Python)  
**Last Updated:** 2025-01-19


# Cross-SDK Compatibility Tests

These tests verify that all SDKs can communicate correctly with each other.

## Test Structure

Each test file tests compatibility between two SDKs:
- `js-python.test.js` - JS client ↔ Python client
- `js-elixir.test.js` - JS client ↔ Elixir client
- `js-rust.test.js` - JS client ↔ Rust client
- `python-elixir.test.py` - Python client ↔ Elixir client
- `python-rust.test.py` - Python client ↔ Rust client
- `elixir-rust.test.exs` - Elixir client ↔ Rust client

## Test Scenarios

1. **Basic Handshake** - Verify handshake_init/handshake_ack works
2. **ECDH Key Exchange** - Verify ECDH keys are exchanged correctly
3. **Message Exchange** - Verify state_update and event messages work
4. **Security Features** - Verify all security features work across SDKs

## Running Tests

```bash
# Run all cross-SDK tests
npm run test:cross-sdk

# Run specific test
node tests/cross-sdk/js-python.test.js
```

## Prerequisites

- LTP Test Server running on `ws://localhost:8080/ws`
- All SDKs built and available


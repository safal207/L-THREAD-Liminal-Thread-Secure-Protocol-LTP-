# L-THREAD / LTP (Liminal Thread Protocol)

**Version:** 0.6.0-alpha.3
**Status:** Production-Ready (Enterprise) | Security Hardened

## Overview

L-THREAD (Liminal Thread Protocol) is a secure transport layer designed for the LIMINAL ecosystem. It serves as a "liminal thread" - a protected communication channel between human devices and LIMINAL OS that preserves context, intent, and inner state throughout the interaction.

📖 **Documentation:**
- [Architecture Overview](./ARCHITECTURE.md) - Ecosystem architecture and SDK comparison
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment strategies
- [API Reference](./API.md) - Complete API documentation for all SDKs
- [Protocol Specifications](./specs/) - Detailed protocol specifications
- [Consciousness Web & Orientation Shell](./specs/LTP-ConsciousnessWeb.md) - Semantic graph + focus layer built atop the Thread Life Model
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute to LTP
- [Changelog](./CHANGELOG.md) - Version history and changes
- [Security Policy](./.github/SECURITY.md) - Security reporting and best practices

📊 **For Investors & Experts:**
- [Investor Pitch](./INVESTOR_PITCH.md) - Executive summary, market opportunity, investment ask
- [Technical Whitepaper](./WHITEPAPER.md) - Deep technical analysis and research paper

### What Makes LTP Different

Unlike traditional HTTPS/WebSocket protocols that treat data as isolated transactions, LTP maintains a continuous **liminal thread session** that:

- Preserves contextual continuity across all messages
- Carries metadata about user intent and inner state
- Enables resonant communication patterns between human and system
- Provides foundation for higher-level semantic protocols

### Architecture Position

LTP operates as a dedicated layer in the LIMINAL stack:

```
┌─────────────────────────────────────┐
│  LRI (Liminal Resonance Interface)  │  ← 8th Layer: Semantic/Intent
│         Application Layer           │
├─────────────────────────────────────┤
│    L-THREAD / LTP (this protocol)   │  ← Transport: Security + Context
├─────────────────────────────────────┤
│     WebSocket / TCP / QUIC          │  ← Standard Transport
└─────────────────────────────────────┘
```

**LTP Role:** Secure transport + context preservation
**LRI Role:** Semantic layer, resonance patterns, intent processing

### Semantic Layers: Thread Life Model → Consciousness Web

- **Thread Life Model** captures the lifecycle of a single thread (birth → active → weakening → switching → archived) with energy/resonance metadata. SDK reference: [`sdk/js/README.consciousness-web.md`](./sdk/js/README.consciousness-web.md).
- **Consciousness Web & Orientation Shell** build on top of that lifecycle to map relationships between threads (parent/child, shared scope/tags) and rotate focus across sectors. Specification: [`specs/LTP-ConsciousnessWeb.md`](./specs/LTP-ConsciousnessWeb.md).

## Key Features (v0.1)

- **Liminal Secure Handshake:** Protocol-level session establishment with future crypto hooks
- **Thread Session Model:** Unique `thread_id` + `session_id` tracking
- **Unified Message Envelope:** JSON-based format for all message types
- **Context Preservation:** Metadata fields for client state and trace tracking
- **Liminal Metadata:** Optional affect and context tags for semantic layers
- **Message Types:** `handshake`, `ping`, `state_update`, `event`

## LTP v0.2 Overview

- **Continuity of the thread:** Clients persist `thread_id` in local storage (browser `localStorage`, filesystem, etc.) and attempt `handshake_resume` before falling back to `handshake_init` so liminal state survives reconnects or app restarts.
- **Heartbeat & reconnect strategy:** SDKs send timed `ping` frames, expect `pong` within a configurable timeout, and automatically reconnect with exponential backoff (default: start at 1s, cap at 30s, stop after 5 tries) before surfacing a permanent failure hook.
- **Security skeleton:** Every envelope carries a unique `nonce` and a placeholder `signature`. Real crypto lands in v0.3+, but v0.2 now clearly documents that deployments MUST run over TLS/WSS and gives the hooks needed for experimental signing.

Lifecycle (storage + resume + heartbeat):

```
[connect()]
   |
   v
[storage has thread_id?] -- no --> [handshake_init] --> [store thread_id]
   |
  yes
   v
[handshake_resume] -- not found --> [handshake_init]
          |
        found
          v
[session established] -> [heartbeat loop] -> [reconnect on failure]
```

**Recommended environment:** Always use `wss://` (or HTTPS/TLS) endpoints until the upcoming signature/verification layer is finalized. Nonces plus TLS provide basic replay protection in the interim.

## LTP v0.3: TOON-aware Payloads

v0.3 introduces optional **TOON (Token-Oriented Object Notation)** support for compact payload encoding, especially useful for large arrays of similar objects (affect logs, event batches, telemetry).

### What is TOON?

TOON is a compact, table-like format designed to reduce token counts for LLM-centric workflows. It's particularly effective for:
- **Affect logs** — arrays of emotional state measurements
- **Event batches** — sequences of similar events
- **Telemetry data** — time-series measurements

**Benefits:**
- **30–60% token reduction** for large arrays
- **Better LLM prompt efficiency** — more data fits in context windows
- **Compact representation** — especially for table-like data

### How TOON Works in LTP

LTP itself doesn't parse TOON — it only carries the `content_encoding` flag. The actual encoding/decoding is handled by application-layer codecs (or dedicated TOON libraries).

**JSON payload (default):**
```json
{
  "type": "state_update",
  "thread_id": "abc",
  "content_encoding": "json",
  "payload": {
    "kind": "affect_log",
    "data": [
      { "t": 1, "valence": 0.2, "arousal": -0.1 },
      { "t": 2, "valence": 0.3, "arousal": -0.2 }
    ]
  }
}
```

**TOON payload (compact):**
```json
{
  "type": "state_update",
  "thread_id": "abc",
  "content_encoding": "toon",
  "payload": {
    "kind": "affect_log",
    "data": "rows[2]{t,valence,arousal}:\n  1,0.2,-0.1\n  2,0.3,-0.2\n"
  }
}
```

### Enabling TOON in SDK

**TypeScript/JavaScript:**

```typescript
import { LtpClient } from '@liminal/ltp-client';
import { simpleToonCodec } from './simpleToonCodec';

const client = new LtpClient('ws://localhost:8080', {
  clientId: 'example-js',
  codec: simpleToonCodec,           // TOON codec implementation
  preferredEncoding: 'toon',        // Use TOON when possible
});

// Send affect log - automatically encoded as TOON
client.sendStateUpdate({
  kind: 'affect_log_v1',
  data: [
    { t: 1, valence: 0.2, arousal: -0.1 },
    { t: 2, valence: 0.3, arousal: -0.2 },
    { t: 3, valence: 0.1, arousal: 0.0 }
  ]
});
```

**When TOON is used:**
- `preferredEncoding: 'toon'` is set
- A `codec` with `encodeJsonToToon` is provided
- Payload data is an array of similar objects

**When JSON is used (fallback):**
- `preferredEncoding` is `'json'` (default)
- No codec provided
- Payload is not an array or has mixed structure

### TOON Codec Implementation

LTP provides a **stub codec** (`simpleToonCodec`) for examples. For production:

- Use a proper TOON library (when available)
- Implement a full TOON codec per specification
- The stub codec is **NOT production-ready** — it's for demonstration only

See `specs/LTP-toon.md` for full TOON specification details.

## Liminal Metadata

LTP supports optional metadata fields designed for higher-level semantic protocols like LRI (Liminal Resonance Interface):

### Affect Metadata

Emotional state indicators for each message:

- **`valence`**: Emotional valence from -1 (negative) to 1 (positive)
- **`arousal`**: Arousal level from -1 (calm) to 1 (excited)

```typescript
{
  affect: {
    valence: 0.3,   // Slightly positive
    arousal: -0.2   // Slightly calm
  }
}
```

### Context Tags

String identifiers for the interaction context:

```typescript
context_tag: "focus_session"  // or "evening_reflection", "work_mode", etc.
```

### Usage in SDK

**Default metadata for all messages:**

```typescript
const client = new LtpClient('ws://localhost:8080', {
  clientId: 'my-device',
  defaultContextTag: 'dev_playground',
  defaultAffect: {
    valence: 0.0,
    arousal: 0.0
  }
});
```

**Per-message overrides:**

```typescript
// State update with explicit affect
client.sendStateUpdate(
  {
    kind: 'minimal',
    data: { focus_level: 0.8 }
  },
  {
    affect: { valence: 0.5, arousal: -0.3 }
  }
);

// Event with explicit context
client.sendEvent(
  'user_action',
  { action: 'started_session' },
  { contextTag: 'focus_session' }
);
```

**Important Notes:**

- These fields are **optional** and designed for future semantic layers
- LTP implementations **do not interpret** these values
- They provide hooks for LRI and other higher-level protocols
- Use them to enrich your application's contextual awareness

## Quick Start

### Prerequisites

- Node.js 18+ (for JavaScript SDK and examples)
- Python 3.9+ (for Python SDK)
- Elixir 1.14+ (for Elixir SDK and server)
- Rust 1.70+ (for Rust SDK and server)

### Run Minimal Example

**Option 1: JavaScript Server + Client**

1. **Start the server:**
   ```bash
   cd examples/js-minimal-server
   npm install && npm start
   ```

2. **In another terminal, run the client:**
   ```bash
   cd examples/js-minimal-client
   npm install && npm start
   ```

**Option 2: Elixir Server**

```bash
cd examples/elixir-server
mix deps.get
mix run --no-halt
```

**Option 3: Rust Server**

```bash
cd examples/rust-server
cargo run
```

You should see the handshake exchange, ping-pong messages, and state updates flowing through the liminal thread. All servers are compatible with all clients!

## Advanced Examples

For production-ready patterns and advanced use cases, see the **advanced examples** directory:

- **[JavaScript Advanced Examples](./examples/js-advanced/)** - Production client wrapper, event-driven architecture, metrics collection
- **[Python Advanced Examples](./examples/python-advanced/)** - Async worker pools, production client with structured logging
- **[Elixir Advanced Examples](./examples/elixir-advanced/)** - Supervised clients, GenServer patterns, batch operations
- **[Rust Advanced Examples](./examples/rust-advanced/)** - Concurrent operations, production client with metrics

These examples demonstrate:
- ✅ Production-ready error handling and reconnection
- ✅ Metrics collection and monitoring
- ✅ Batch operations with TOON encoding
- ✅ Event-driven architecture patterns
- ✅ Structured logging and observability
- ✅ Graceful shutdown and resource management

## Performance Benchmarks

Performance benchmarks are available to compare encoding strategies, throughput, and latency:

- **[Benchmarks Overview](./benchmarks/README.md)** - Complete benchmark documentation
- **JSON vs TOON** - Size reduction and encoding performance comparison
- **Throughput** - Message sending performance metrics

**Quick start:**
```bash
# JavaScript benchmarks
cd benchmarks/js
node json-vs-toon.js

# Python benchmarks
cd benchmarks/python
python json_vs_toon.py
```

See [benchmarks/README.md](./benchmarks/README.md) for detailed results and interpretation guidelines.

## SDK Ecosystem

LTP provides **multi-language SDK support** for seamless integration across different platforms and use cases:

| SDK | Version | Status | Best For |
|-----|---------|--------|----------|
| **JavaScript/TypeScript** | v0.3.0 | ✅ Production | Web browsers, Node.js apps |
| **Python** | v0.3.0 | ✅ Production | ML/AI pipelines, scripting |
| **Elixir** | v0.1.0 | ✅ Production | Real-time backends, high concurrency |
| **Rust** | v0.1.0 | ✅ Production | Edge computing, crypto, low-latency |

All SDKs are **100% protocol-compatible** and can communicate seamlessly. A client written in one language can connect to a server written in another, as long as both implement the LTP v0.3 specification.

📖 **See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed comparison, architecture overview, and deployment scenarios.**

## SDK Usage

### TypeScript/JavaScript

```typescript
import { LtpClient } from '@liminal/ltp-client';

const client = new LtpClient('ws://localhost:8080', {
  clientId: 'my-device-123'
});

await client.connect();

// Send state update
client.sendStateUpdate({
  kind: 'minimal',
  data: { mood: 'curious', focus: 'exploration' }
});

// Send event
client.sendEvent('user_action', {
  action: 'button_click',
  target: 'explore_mode'
});
```

### Python

```python
from ltp_client import LtpClient

client = LtpClient('ws://localhost:8080', client_id='my-device-123')
await client.connect()

# Send state update
await client.send_state_update({
    'kind': 'minimal',
    'data': {'mood': 'curious', 'focus': 'exploration'}
})

# Send event
await client.send_event('user_action', {
    'action': 'button_click',
    'target': 'explore_mode'
})
```

### Elixir

```elixir
{:ok, pid} = LTP.Client.start_link(%{
  url: "ws://localhost:8080",
  client_id: "elixir-example-1",
  default_context_tag: "evening_reflection"
})

:ok = LTP.Client.send_state_update(pid, %{
  kind: "affect_log_v1",
  data: [
    %{t: 1, valence: 0.2, arousal: -0.1},
    %{t: 2, valence: 0.3, arousal: -0.2}
  ]
})

:ok = LTP.Client.send_event(pid, "user_action", %{
  action: "button_click",
  target: "explore_mode"
})
```

### Rust

```rust
use ltp_client::LtpClient;
use serde_json::json;

let mut client = LtpClient::new("ws://localhost:8080", "rust-example-1")
    .with_default_context_tag("evening_reflection");

client.connect().await?;

client.send_state_update(
    "affect_log_v1",
    vec![
        json!({"t": 1, "valence": 0.2, "arousal": -0.1}),
        json!({"t": 2, "valence": 0.3, "arousal": -0.2}),
    ],
).await?;

client.send_event(
    "user_action",
    json!({"action": "button_click", "target": "explore_mode"}),
).await?;
```

## Example Scenario: Evening Reflection

LTP is designed to carry **semantic intent** (via LRI) through a **secure transport** layer. Here's a real-world example:

### The Scenario

> At the end of the day, a user opens their liminal client to reflect on their state. They note their energy, clarity, stress, and key highlights. This creates a "thread of the day" that flows into LIMINAL OS.

### The Message (LTP + LRI)

```json
{
  "type": "state_update",
  "thread_id": "4f3c9e2a-8b21-4c71-9d3f-1a9b12345678",
  "session_id": "b42a6f10-91a7-4ce2-8b7e-9d5f98765432",
  "timestamp": 1731700000,
  "meta": {
    "client_id": "android-liminal-001",
    "trace_id": "evt-2025-11-15-001",
    "affect": {
      "valence": 0.2,
      "arousal": -0.3
    },
    "context_tag": "evening_reflection"
  },
  "payload": {
    "kind": "lri_envelope_v1",
    "data": {
      "actor": "user:self",
      "intent": "reflect_on_day",
      "summary": "Slightly tired, but feeling a sense of quiet progress.",
      "highlights": [
        "played with kids",
        "advanced LTP protocol",
        "less anxiety about the future"
      ],
      "inner_state": {
        "energy": 0.4,
        "clarity": 0.7,
        "stress": 0.3
      },
      "resonance_hooks": [
        "family",
        "creator_path",
        "long_horizon"
      ]
    }
  }
}
```

### Layer Breakdown

**LTP (Transport/Meta):**
- `type`, `thread_id`, `session_id`, `timestamp` - routing and session
- `meta.client_id`, `meta.trace_id` - infrastructure metadata

**LRI (Semantic):**
- `meta.affect` - emotional state (valence/arousal)
- `meta.context_tag` - semantic context label
- `payload.data.*` - all semantic content (intent, state, resonance)

### Server Processing

When the server receives this message:

```
LTP[4f3c9e2a.../b42a6f10...] ctx=evening_reflection affect={0.2,-0.3} intent=reflect_on_day
```

The server can then:
1. **LTP layer** - Route message, maintain session context
2. **LRI layer** - Extract intent, match resonance hooks, update RINSE (Resonance INner State Engine)
3. **Response** - Send back resonance score and insights

See `specs/LTP-message-format.md` section 9 for full details.

## Repository Structure

```
.
├── README.md                    # This file
├── ARCHITECTURE.md              # Ecosystem architecture overview
├── DEPLOYMENT.md                # Deployment guide
├── API.md                       # API reference documentation
├── benchmarks/                  # Performance benchmarks
│   ├── js/                      # JavaScript benchmarks
│   └── python/                  # Python benchmarks
├── specs/
│   ├── LTP-core.md              # Core protocol architecture
│   ├── LTP-handshake.md         # Handshake protocol
│   ├── LTP-message-format.md   # Message envelope spec
│   └── LTP-toon.md             # TOON encoding specification
├── sdk/
│   ├── js/                      # TypeScript SDK
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── client.ts
│   │   │   └── index.ts
│   │   └── package.json
│   └── python/                  # Python SDK
│       └── ltp_client/
│           ├── __init__.py
│           ├── types.py
│           └── client.py
└── examples/
    ├── js-minimal-client/       # JavaScript client example
    ├── js-minimal-server/       # JavaScript server example
    ├── js-advanced/             # JavaScript advanced examples
    ├── python-advanced/         # Python advanced examples
    ├── elixir-server/           # Elixir server example
    ├── elixir-advanced/        # Elixir advanced examples
    ├── rust-server/             # Rust server example
    └── rust-advanced/          # Rust advanced examples
```

## Roadmap

### v0.1 (Current)
- [x] Basic protocol specification
- [x] JSON message envelope format
- [x] TypeScript and Python SDKs
- [x] Minimal client/server examples
- [ ] Basic documentation

### v0.3 (Current)
- [x] TOON payload encoding support
- [x] `content_encoding` field in message envelope
- [x] TOON codec interface and stub implementation
- [x] Automatic TOON encoding for arrays in JS SDK
- [x] TOON-aware logging in examples

### v0.4 (Planned)
- [ ] Real cryptographic handshake (key exchange, signatures)
- [ ] Enhanced inner state metadata schema
- [ ] Compression support (zstd)
- [ ] Binary message format option (CBOR, MessagePack)
- [ ] Rate limiting and flow control

### v0.3+ (Future)
- [ ] Multi-device thread synchronization
- [ ] Advanced resonance pattern matching
- [ ] LRI integration examples
- [ ] Production-grade error handling
- [ ] Performance benchmarks

## Concepts

### Liminal Thread

A **liminal thread** is a persistent communication channel that exists "between" traditional request-response cycles. It maintains continuity of context, allowing the system to understand not just *what* the user is doing, but the underlying flow of their interaction and intent.

### Inner State

User's current cognitive and emotional context - attention, focus, intent clarity, emotional resonance. LTP preserves hooks for this data without imposing specific schemas (v0.1 keeps this minimal).

### Resonance

The alignment between user intent and system response. LTP provides the transport; LRI (the layer above) interprets and acts on resonance patterns.

## Contributing

This protocol is in early development. Contributions, suggestions, and discussions are welcome.

## License

See LICENSE file for details.

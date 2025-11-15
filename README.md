# L-THREAD / LTP (Liminal Thread Protocol)

**Version:** 0.1
**Status:** Initial Development

## Overview

L-THREAD (Liminal Thread Protocol) is a secure transport layer designed for the LIMINAL ecosystem. It serves as a "liminal thread" - a protected communication channel between human devices and LIMINAL OS that preserves context, intent, and inner state throughout the interaction.

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

## Key Features (v0.1)

- **Liminal Secure Handshake:** Protocol-level session establishment with future crypto hooks
- **Thread Session Model:** Unique `thread_id` + `session_id` tracking
- **Unified Message Envelope:** JSON-based format for all message types
- **Context Preservation:** Metadata fields for client state and trace tracking
- **Message Types:** `handshake`, `ping`, `state_update`, `event`

## Quick Start

### Prerequisites

- Node.js 18+ (for JavaScript SDK and examples)
- Python 3.9+ (for Python SDK)

### Run Minimal Example

1. **Install dependencies:**
   ```bash
   cd examples/js-minimal-server
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **In another terminal, run the client:**
   ```bash
   cd examples/js-minimal-client
   npm install
   npm start
   ```

You should see the handshake exchange, ping-pong messages, and state updates flowing through the liminal thread.

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
├── README.md
├── specs/
│   ├── LTP-core.md              # Core protocol architecture
│   ├── LTP-handshake.md         # Handshake protocol
│   └── LTP-message-format.md    # Message envelope spec
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
    ├── js-minimal-client/       # Example client
    └── js-minimal-server/       # Example server
```

## Roadmap

### v0.1 (Current)
- [x] Basic protocol specification
- [x] JSON message envelope format
- [x] TypeScript and Python SDKs
- [x] Minimal client/server examples
- [ ] Basic documentation

### v0.2 (Planned)
- [ ] Real cryptographic handshake (key exchange, signatures)
- [ ] Enhanced inner state metadata schema
- [ ] Compression support
- [ ] Reconnection and session recovery
- [ ] Binary message format option
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

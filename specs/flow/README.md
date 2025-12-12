# Flow v0.1 Golden Transcript

This directory contains a deterministic JSONL transcript that captures the minimal Flow v0.1 handshake for LTP Frames. Each line represents a single frame with stable identifiers and timestamps.

## Files
- `golden-transcript.v0.1.jsonl` — canonical sequence covering hello/hello response, heartbeats, orientation, route negotiation, and focus snapshot.

## How to use
- **Validate**: run the Flow contract test to ensure frames conform to the reference schema.
- **Replay**: use the JS SDK demo to emit the exact same transcript as JSONL.

## Commands
From the repository root:

```bash
cd sdk/js
npm run demo:flow    # prints the golden transcript to stdout
npm run test:flow-contract
```

The test builds the SDK and checks that every frame in the golden transcript matches the Flow v0.1 contract (order, schema, and routing confidence totals).

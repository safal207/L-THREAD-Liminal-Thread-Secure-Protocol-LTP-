# Quickstart: Developer Tools

## What problem this solves
Developers need to inspect, validate, and debug LTP traces without setting up a full node environment. This guide shows how to use the CLI tools to verify trace integrity and compliance locally.

## Prerequisites

- Node.js 18 or 20 (LTS)
- npm or pnpm

## 5-minute run

1. **Install the CLI tool globally:**

   ```bash
   npm install -g @ltp/inspect
   ```

2. **Download a sample trace (or use your own):**

   ```bash
   # Create a dummy trace for testing
   echo '{"h": "0000", "p": null, "t": "hello", "c": {"client": "ltp-cli"}}' > test.trace.jsonl
   ```

3. **Inspect the trace:**

   ```bash
   ltp inspect trace --input test.trace.jsonl
   ```

## Success criteria

Expected command:

```bash
ltp inspect trace --input test.trace.jsonl
```

Expected output:

```text
Status: PASS (Valid Structure)
Integrity: OK
```

If you see **Status: PASS** — you’re good.

## What guarantees are provided

- **Structure Validation**: Ensures the JSON structure matches the LTP schema.
- **Hash Integrity**: Verifies that the hash chain (if present) is unbroken.
- **Protocol Compliance**: Checks for unknown frames or illegal sequences.

## Link to deeper docs

- [LTP Inspect Tool Documentation](../devtools/inspector.md)
- [Trace Format Specification](../../specs/LTP-message-format.md)

### Next steps
- [Agents Safety Quickstart](./agents.md)
- [Fintech Compliance Quickstart](./fintech.md)

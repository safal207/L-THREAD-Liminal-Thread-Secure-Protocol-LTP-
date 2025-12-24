# Quickstart: Fintech Compliance

## What problem this solves

Fintech applications require immutable audit logs and regulatory compliance verification. This guide demonstrates how to validate a trace against the Fintech profile using LTP tools.

## Prerequisites

- Node.js 18 or 20 (LTS)
- `@ltp/inspect` installed globally

## 5-minute run

1. **Generate a compliant trace (simulation):**

   ```bash
   # In a real scenario, this comes from your application
   echo '[{"h":"hash1","p":null,"t":"hello","c":{"id":"req-1"}}, {"h":"hash2","p":"hash1","t":"orientation","c":{"decision":"permit"}}]' > fintech.trace.json
   ```

2. **Run compliance check:**

   ```bash
   ltp-inspect fintech.trace.json --compliance fintech
   ```

## Success criteria

Expected command:

```bash
ltp-inspect fintech.trace.json --compliance fintech
```

Expected output:

```text
LTP INSPECT v0.1.0
==================
Compliance Profile: FINTECH

[PASS] Identity Binding
[PASS] Hash Chain Integrity
[PASS] Replay Determinism

Verdict: PASS
Risk Level: LOW
Regulator Ready: YES
```

If you see **Verdict: PASS** — you’re good.

## What guarantees are provided

- **Audit Summary**: Provides a computed verdict ('PASS'|'FAIL') and risk level.
- **Immutable History**: Verifies SHA-256 hash chains to detect tampering.
- **Identity Binding**: Ensures actions are cryptographically bound to an identity.

## Link to deeper docs

> **Tip:** If you are building autonomous agents, see [Agent Safety](./agents.md).

### Troubleshooting
- **Command not found**: Ensure you installed the tool globally (`npm install -g @ltp/inspect`) or use `npx @ltp/inspect`.
- **Integrity Check Fails**: If you see `TRACE INTEGRITY BROKEN`, the trace file has been tampered with or corrupted.

- [Fintech Compliance Inspection](../fintech/Compliance-Inspection.md)
- [How Auditor Reads LTP Trace](../fintech/How-Auditor-Reads-LTP-Trace.md)

# Quickstart: AI Agents Safety

## What problem this solves

AI Agents need to be prevented from taking critical actions (like money transfer or data deletion) when triggered by untrusted contexts (like a web request) without explicit admissibility checks.

## Prerequisites

- Node.js 18 or 20 (LTS)
- `@ltp/inspect` installed globally

## 5-minute run

1. **Create a risky trace (simulation):**

   ```bash
   # Simulating a WEB context triggering a critical action directly
   echo '[{"h":"1","t":"route_request","c":{"context":"WEB","intent":"transfer_money"}}]' > risky.trace.json
   ```

2. **Verify against Agent Safety Rules:**

   ```bash
   ltp-inspect risky.trace.json --compliance agents
   ```

## Success criteria

Expected command:

```bash
ltp-inspect risky.trace.json --compliance agents
```

Expected output:

```text
LTP INSPECT v0.1.0
==================
Compliance Profile: AGENTS

[FAIL] Rule AGENTS.CRIT.WEB_DIRECT
       Evidence: Critical action 'transfer_money' triggered by 'WEB' context without admissibility check.

Verdict: FAIL
Violations: 1
```

If you see **Verdict: FAIL** — you’re good (this means the safety catch is working).

## What guarantees are provided

- **Action Boundaries**: Enforces "deny-by-default" for critical actions.
- **Context Awareness**: Distinguishes between trusted (USER) and untrusted (WEB) contexts.
- **Admissibility Check**: Ensures an explicit policy decision precedes execution.

## Link to deeper docs

- [Agent Safety Rules](../agents/Agent-Safety-Rules-v0.1.md)
- [Configuring Critical Actions](../agents/Configuring-Critical-Actions.md)

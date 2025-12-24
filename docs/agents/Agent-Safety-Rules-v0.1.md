# Agent Safety Rules v0.1

**Status:** Frozen / Enforced
**Profile:** Agentic Safety

## 1. The Golden Rule: Context != Action

> "A Web context cannot initiate a critical action."

This is the primary invariant of the LTP Agent Safety profile. It prevents prompt injection by decoupling "understanding" (LLM) from "authority" (LTP).

## 2. Critical Actions

The following actions are defined as critical and MUST be blocked if the transition context is `WEB` or `UNTRUSTED`:

- `transfer_money`
- `delete_data`
- `send_email`
- `approve_trade`
- `modify_system`
- `delete_file`

### Configuration
Critical actions can be configured via:
1. Environment Variable: `LTP_CRITICAL_ACTIONS` (comma-separated)
2. Config File: `LTP_CRITICAL_ACTIONS_FILE` (JSON)

## 3. Global Bans

The following actions are **permanently banned** regardless of context (USER or ADMIN):

- `rm -rf`
- `format_disk`

## 4. Reason Codes

All blocks must be deterministic and return one of the following codes:

| Code | Meaning |
|------|---------|
| `WEB_ORIGIN_FORBIDDEN_FOR_CRITICAL_ACTION` | Attempt to bridge Web context to Critical Action. |
| `GLOBAL_SAFETY_VIOLATION` | Action is on the permanent ban list. |
| `PROMPT_INJECTION_DETECTED` | Heuristic detection of adversarial prompting. |

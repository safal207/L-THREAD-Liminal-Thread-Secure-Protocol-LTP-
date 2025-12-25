# Agent Safe Defaults: Configuration Guide

This guide outlines the "Secure by Design" default configurations for deploying LTP-compliant AI Agents.

## 1. Action Boundary Enforcement

By default, the LTP Reference Agent enforces a **Deny-by-Default** policy for critical actions originating from untrusted contexts (like `WEB`).

### Environment Variables

| Variable | Safe Default | Description |
| :--- | :--- | :--- |
| `LTP_ACTION_POLICY` | `deny-by-default` | Blocks all Critical Actions unless explicitly allowed. |
| `LTP_CRITICAL_ACTIONS` | *(empty)* | Defaults to the canonical list (money, data, etc.). |
| `LTP_ALLOW_WEB_CRITICAL` | `false` | Strictly forbids WEB-origin transitions from triggering critical actions. |

### Canonical Critical Actions (Implicit)

If `LTP_CRITICAL_ACTIONS` is not set, the system automatically treats the following as critical:

*   `transfer_money`
*   `place_order`
*   `send_message` (external)
*   `delete_data`
*   `grant_access`
*   `modify_system`
*   `execute_code`

## 2. Enabling Critical Actions (The "Conscious Unblocking" Pattern)

To allow a critical action, you must NOT just disable the safety check. Instead, you must:

1.  **Elevate the Context:** The request should come from an authenticated user (`USER`) or a system admin (`ADMIN`), not `WEB`.
2.  **Grant Capability:** The agent must have the explicit capability for that action.

**Bad Practice (Do NOT do this):**
```bash
# DANGEROUS: Disables all protections
LTP_ACTION_POLICY=allow-all
```

**Good Practice (Configuration):**
```bash
# Explicitly define what is critical (extends default list)
LTP_CRITICAL_ACTIONS="transfer_money,delete_production_db"
```

## 3. Deployment Checklist

Before deploying your agent to production:

- [ ] Run `ltp inspect trace --compliance agents` on your test traces.
- [ ] Verify that `LTP_ACTION_POLICY` is NOT set to `allow-all`.
- [ ] Ensure `LTP_ALLOW_WEB_CRITICAL` is false or unset.
- [ ] Audit your custom `LTP_CRITICAL_ACTIONS` list.

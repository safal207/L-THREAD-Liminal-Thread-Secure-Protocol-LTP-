# LTP Canonical Standard: Critical Actions v0.1

**Status:** Draft / Proposed
**Version:** v0.1
**Type:** Standard

## 1. Purpose

To define a canonical list of "Critical Actions" for LTP-compliant Agent Systems, ensuring that integrators, SDKs, and compliance tools share a common vocabulary for high-risk operations.

## 2. Standard Critical Actions

Action names must use `snake_case`.

| Action Name | Domain Tag (Optional) | Description | Requirements |
| :--- | :--- | :--- | :--- |
| `transfer_money` | `fintech` | Initiating a transfer of value between accounts. | **Signature**, **Replay-Check** |
| `place_order` | `commerce`, `fintech` | Creating a binding order for goods, services, or assets. | **Signature**, **Replay-Check** |
| `send_message` | `content`, `social` | Sending a message to an external party or public channel. | **Policy-Check** |
| `delete_data` | `ops`, `privacy` | Permanently removing data or resources. | **Confirmation**, **Policy-Check** |
| `grant_access` | `ops`, `security` | Modifying permissions or granting access to resources. | **Signature**, **Audit-Log** |
| `modify_system` | `ops` | Changing system configuration or state. | **Audit-Log**, **Policy-Check** |
| `execute_code` | `ops`, `security` | Running arbitrary code or scripts. | **Isolation**, **Audit-Log** |

*Note: This list is extensible via specific domain profiles, but these are the core reserved actions.*

## 3. Canonical Rules

These rules define the boundary enforcement for critical actions.

### Rule 1: No Direct Execution from Untrusted Sources
**ID:** `AGENTS.CRIT.WEB_DIRECT`
*   "WEB cannot directly trigger critical action."
*   Any `ProposedTransition` originating from an untrusted source (e.g., `WEB`, `ANONYMOUS`) that targets a Critical Action must be denied by default.

### Rule 2: Capability Requirement
**ID:** `AGENTS.CRIT.NO_CAPABILITY`
*   "Critical action requires explicit capability."
*   The agent must possess the specific capability (e.g., `CAPABILITY_TRANSFER_MONEY`) to propose a Critical Action, regardless of the source.

### Rule 3: Admissibility Pass
**ID:** `AGENTS.CRIT.NO_ADMISSIBILITY`
*   "Critical action requires admissibility pass."
*   Even with the correct source and capability, the action must pass the LTP Admissibility Check (e.g., policy constraints, rate limits).

### Rule 4: Verified Identity
**ID:** `AGENTS.CRIT.UNVERIFIED_IDENTITY`
*   "Critical action requires verified identity."
*   The identity initiating the action chain must be cryptographically bound or reliably authenticated (no `guest` or `unknown` actors for critical paths).

## 4. Implementation Guidelines

*   **Enforcement:** Enforcement happens at the *Admissibility Layer*, not the *LLM Layer*.
*   **Logging:** Blocked critical actions must be logged with the corresponding Rule ID.
*   **Configuration:** Systems should support `LTP_CRITICAL_ACTIONS` configuration to extend this list.

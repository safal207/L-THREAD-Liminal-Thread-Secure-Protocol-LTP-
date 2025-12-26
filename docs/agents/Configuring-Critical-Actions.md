# Configuring Critical Actions

LTP Agent Safety v0.1 supports configurable lists of critical actions. This allows you to expand the safety boundary without modifying the core agent code.

## 1. Environment Variable

The simplest way to configure critical actions is via the `LTP_CRITICAL_ACTIONS` environment variable.

```bash
export LTP_CRITICAL_ACTIONS="transfer_money,delete_production_db,deploy_code"
```

## 2. JSON Configuration File

For more complex configurations, point to a JSON file using `LTP_CRITICAL_ACTIONS_FILE`.

```bash
export LTP_CRITICAL_ACTIONS_FILE="./config/safety-policy.json"
```

**File Format:**

```json
{
  "criticalActions": [
    "transfer_money",
    "delete_data",
    "send_email"
  ]
}
```

## 3. Defaults

If no configuration is provided, the system defaults to the Standard Safety Profile:

- `transfer_money`
- `delete_data`
- `send_email`
- `approve_trade`
- `modify_system`
- `delete_file`

## 4. Verification

You can verify your configuration is active by running:

```bash
ltp inspect trace --compliance agents --input <trace-file>
```

The inspector will validate that no Web-origin events successfully triggered any action in your configured list.

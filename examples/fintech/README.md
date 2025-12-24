# Fintech Compliance Example

This example demonstrates a trace that adheres to the Fintech compliance profile, featuring hash chaining and explicit decision tracking.

## Contents

- `sample.trace.json`: A trace simulating a financial transaction approval flow.

## How to Run

1. **Install ltp-inspect**:
   ```bash
   npm install -g @ltp/inspect
   ```

2. **Verify compliance**:
   ```bash
   ltp-inspect sample.trace.json --compliance fintech
   ```

## Expected Output

```text
Compliance Profile: FINTECH
[PASS] Identity Binding
[PASS] Hash Chain Integrity
Verdict: PASS
```

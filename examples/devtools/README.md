# Developer Tools Example

This directory contains resources to demonstrate the usage of LTP developer tools, specifically `ltp-inspect`.

## Contents

- `sample.trace.json`: A minimal valid LTP trace file for testing.

## How to Run

1. **Install ltp-inspect**:
   ```bash
   npm install -g @ltp/inspect
   ```

2. **Inspect the trace**:
   ```bash
   ltp-inspect sample.trace.json
   ```

## Expected Output

```text
Trace: sample.trace.json
Status: PASS (Valid Structure)
...
```

# Agent Safety Example

This example demonstrates a compliant agent trace where a critical action is properly gated by an admissibility check, and a non-compliant trace for comparison.

## Contents

- `sample.trace.jsonl`: A trace showing a safe interaction flow.

## How to Run

1. **Install ltp-inspect**:
   ```bash
   npm install -g @ltp/inspect
   ```

2. **Verify agent safety**:
   ```bash
   ltp-inspect sample.trace.jsonl --compliance agents
   ```

## Expected Output

```text
Compliance Profile: AGENTS
Verdict: PASS
```

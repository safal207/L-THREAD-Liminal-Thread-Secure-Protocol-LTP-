#!/bin/bash
set -e

# Fintech Compliance Verification Script
# Usage: ./scripts/check-compliance.sh <trace_file>

TRACE_FILE="${1:-examples/fintech/sample.trace.jsonl}"

echo "Verifying fintech compliance for $TRACE_FILE..."

# Run inspector via workspace script.
# Use -s (silent) so stdout is ONLY the JSON contract (no pnpm banners).
# Note: In this environment, passing '--' with '-s' seems to cause argument parsing issues,
# so we pass 'trace' directly which works for this script.
INSPECT_CMD=(pnpm -s -w ltp:inspect trace)

# Write ONLY JSON to file. If something goes wrong, we keep errors on stderr.
"${INSPECT_CMD[@]}" --input "$TRACE_FILE" --compliance fintech --format json > compliance_report.json

# If we got here, command succeeded due to `set -e`.

echo "Compliance report written to compliance_report.json"

# Parse JSON result (simple grep for now, proper JSON parsing recommended)
if grep -q '"trace_integrity": "verified"' compliance_report.json && \
   grep -q '"identity_binding": "ok"' compliance_report.json && \
   grep -q '"replay_determinism": "ok"' compliance_report.json; then
  echo "Compliance check PASSED"
  cat compliance_report.json
  exit 0
else
  echo "Compliance check FAILED (Violations found)"
  cat compliance_report.json
  exit 1
fi

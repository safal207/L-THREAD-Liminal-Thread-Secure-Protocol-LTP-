#!/bin/bash
set -e

# Fintech Compliance Verification Script
# Usage: ./scripts/check-compliance.sh <trace_file>

TRACE_FILE=$1

if [ -z "$TRACE_FILE" ]; then
  echo "Usage: $0 <trace_file>"
  exit 1
fi

echo "Verifying fintech compliance for $TRACE_FILE..."

# Assuming @ltp/inspect is available in PATH or via pnpm
# If in CI environment within monorepo:
INSPECT_CMD="pnpm -w ltp:inspect"

$INSPECT_CMD -- --input "$TRACE_FILE" --compliance fintech --format json > compliance_report.json

# Check exit code
if [ $? -ne 0 ]; then
  echo "Compliance check FAILED"
  exit 1
fi

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

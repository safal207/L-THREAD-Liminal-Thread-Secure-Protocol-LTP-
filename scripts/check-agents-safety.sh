#!/bin/bash
set -e

# Agent Safety Verification Script
# Usage: ./scripts/check-agents-safety.sh

# Ensure local build
pnpm -C packages/inspect build

# Ensure golden traces exist
echo "Generating Golden Traces..."
node scripts/generate-agent-safety-traces.js

TRACE_DIR="artifacts/traces/golden/agents"
INSPECT_CMD="node packages/inspect/bin/ltp.js"

echo "=== Agent Safety Golden Trace Verification ==="

# 1. Trace A: WEB Injection (Expect FAIL with AGENTS.CRIT.WEB_DIRECT)
echo "[TEST] Trace A: Web Injection -> Critical Action"
OUTPUT_A=$($INSPECT_CMD --input "$TRACE_DIR/trace_a_web_injection.jsonl" --compliance agents --format json 2>&1 || true)

if echo "$OUTPUT_A" | grep -q "AGENTS.CRIT.WEB_DIRECT"; then
  echo "  ✅ Caught AGENTS.CRIT.WEB_DIRECT"
else
  echo "  ❌ FAILED to catch AGENTS.CRIT.WEB_DIRECT"
  echo "$OUTPUT_A"
  exit 1
fi

# 2. Trace B: Missing Capability (Expect FAIL with AGENTS.CRIT.NO_CAPABILITY)
echo "[TEST] Trace B: Missing Capability"
OUTPUT_B=$($INSPECT_CMD --input "$TRACE_DIR/trace_b_missing_cap.jsonl" --compliance agents --format json 2>&1 || true)

if echo "$OUTPUT_B" | grep -q "AGENTS.CRIT.NO_CAPABILITY"; then
  echo "  ✅ Caught AGENTS.CRIT.NO_CAPABILITY"
else
  echo "  ❌ FAILED to catch AGENTS.CRIT.NO_CAPABILITY"
  echo "$OUTPUT_B"
  exit 1
fi

# 3. Trace C: Valid (Expect PASS)
echo "[TEST] Trace C: Valid User + Capability"
OUTPUT_C=$($INSPECT_CMD --input "$TRACE_DIR/trace_c_valid.jsonl" --compliance agents --format json 2>&1 || true)

if echo "$OUTPUT_C" | grep -q '"verdict":"PASS"'; then
  echo "  ✅ Verdict: PASS"
else
  echo "  ❌ FAILED (Expected PASS)"
  echo "$OUTPUT_C"
  exit 1
fi

echo "=== ALL SAFETY CHECKS PASSED ==="
exit 0

#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"

mkdir -p "$RESULTS_DIR"

timestamp() {
  date -u +%Y%m%dT%H%M%SZ
}

run_js() {
  local outfile="$RESULTS_DIR/js-json-vs-toon-$(timestamp).log"
  echo "[JS] Running JSON vs TOON benchmark..."
  (cd "$SCRIPT_DIR/js" && node json-vs-toon.js) | tee "$outfile"
  echo "[JS] Results written to $outfile"
}

run_python() {
  local outfile="$RESULTS_DIR/python-json-vs-toon-$(timestamp).log"
  echo "[Python] Running JSON vs TOON benchmark..."
  (cd "$SCRIPT_DIR/python" && python3 json_vs_toon.py) | tee "$outfile"
  echo "[Python] Results written to $outfile"
}

echo "=== LTP Cross-language SDK Benchmark Runner ==="
echo "This script runs the existing JSON vs TOON benchmarks for JS and Python"
echo "to make it easy to compare encoding/decoding performance across SDKs."
echo

run_js
echo
run_python

echo
echo "=== Done ==="
echo "Collected logs in: $RESULTS_DIR"

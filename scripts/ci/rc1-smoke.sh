#!/usr/bin/env bash
# RC1 smoke runner: shared fixtures + SDK-level smoke across languages.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${ROOT_DIR}"

failures=()

run_step() {
  local name="$1"
  shift
  printf '\n---- %s\n' "${name}" >&2
  if "$@"; then
    printf '✅ %s\n' "${name}" >&2
  else
    local exit_code=$?
    printf '❌ %s (exit %s)\n' "${name}" "${exit_code}" >&2
    failures+=("${name}")
  fi
}

printf 'Running LTP v0.1 RC1 smoke from %s\n' "${ROOT_DIR}" >&2

run_step "Conformance fixtures (v0.1)" pnpm -w ltp:conformance verify:dir fixtures/conformance/v0.1 --out reports/rc1.json --format text
run_step "JS SDK build" pnpm --filter @liminal/ltp-client run build
run_step "Rust SDK tests" bash -c "cd sdk/rust/ltp-client && cargo test"
run_step "Python SDK tests" bash -c "cd sdk/python && python -m pytest tests"
run_step "Elixir SDK tests" bash -c "cd sdk/elixir && mix deps.get && mix test --trace"
run_step "Cross-SDK type consistency" node tests/cross-sdk/verify-types.js

if [ ${#failures[@]} -eq 0 ]; then
  printf '\n✅ RC1 ready\n' >&2
  exit 0
else
  printf '\n❌ RC1 smoke failed: %s\n' "${failures[*]}" >&2
  exit 1
fi

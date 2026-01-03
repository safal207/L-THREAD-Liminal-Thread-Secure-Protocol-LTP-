#!/bin/bash
set -euo pipefail

# Fail if forbidden patterns exist
echo "Checking for forbidden patterns..."

# 1. Check for .trace.json files (excluding .jsonl)
# We ignore common artifact dirs via pruning
FOUND_TRACE_JSON=$(
  find . \
    -path "./.git" -prune -o \
    -path "./node_modules" -prune -o \
    -path "./dist" -prune -o \
    -path "./build" -prune -o \
    -path "./.turbo" -prune -o \
    -path "./.next" -prune -o \
    -name "*.trace.json" -print 2>/dev/null || true
)
if [ -n "$FOUND_TRACE_JSON" ]; then
  echo "FAIL: Found .trace.json files. Please rename to .trace.jsonl"
  echo "$FOUND_TRACE_JSON"
  exit 1
fi

# 2. Check for canonical-clean.json references (should be canonical-linear.jsonl)
# Excluding the script itself, git, and CHANGELOG.md (for historical reference)
if grep -R --line-number --fixed-strings \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=.turbo --exclude-dir=.next \
  --exclude="ci-guardrail.sh" --exclude="CHANGELOG.md" \
  "canonical-clean.json" . > /dev/null; then
  echo "FAIL: Found references to canonical-clean.json. Please update to canonical-linear.jsonl"
  grep -R --line-number --fixed-strings \
    --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=.turbo --exclude-dir=.next \
    --exclude="ci-guardrail.sh" --exclude="CHANGELOG.md" \
    "canonical-clean.json" .
  exit 1
fi

# 2.5 Check for legacy --input *.json usage (trace inputs must be .jsonl)
# We only scan places where humans copy/paste commands: docs/, examples/, scripts/, workflows
# We exclude schema files and common JSON configs.
LEGACY_INPUT_JSON_HITS=$(
  grep -R --line-number --extended-regexp \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=build \
    --exclude-dir=.turbo \
    --exclude="ci-guardrail.sh" \
    -- "--input" \
    .github/workflows docs examples scripts \
  | grep -E -- "--input(=|[[:space:]]+)[^[:space:]]+\.json([[:space:]]|$)" \
  | grep -vE "\.schema\.json([[:space:]]|$)" \
  | grep -vE "package\.json([[:space:]]|$)" \
  | grep -vE "tsconfig\.json([[:space:]]|$)" \
  | grep -vE "eslint.*\.json([[:space:]]|$)" \
  | grep -vE "prettier.*\.json([[:space:]]|$)" \
  || true
)

if [ -n "$LEGACY_INPUT_JSON_HITS" ]; then
  echo "FAIL: Found '--input <file>.json' usage. Trace inputs must be JSONL (.jsonl)."
  echo "Update commands to: --input <file>.jsonl"
  echo ""
  echo "$LEGACY_INPUT_JSON_HITS"
  exit 1
fi

# 3. Check for deprecated `ltp-inspect` usage in docs, examples, scripts, workflows
if grep -R --line-number \
  --exclude-dir=.git --exclude-dir=node_modules --exclude="ci-guardrail.sh" \
  "ltp-inspect" docs examples scripts .github/workflows > /dev/null; then
  # Filter out schema/contract references and file paths (tools/ltp-inspect)
  if grep -R --line-number \
    --exclude-dir=node_modules --exclude="ci-guardrail.sh" \
    "ltp-inspect" docs examples scripts .github/workflows \
    | grep -v "schema.json" \
    | grep -v "contract" \
    | grep -v "ltp-inspect.v1.md" \
    | grep -v "tools/ltp-inspect" \
    > /dev/null; then
    echo "FAIL: Found references to legacy 'ltp-inspect'. Please use 'ltp inspect'."
    grep -R --line-number \
      --exclude-dir=node_modules --exclude="ci-guardrail.sh" \
      "ltp-inspect" docs examples scripts .github/workflows \
      | grep -v "schema.json" \
      | grep -v "contract" \
      | grep -v "ltp-inspect.v1.md" \
      | grep -v "tools/ltp-inspect"
    exit 1
  fi
fi

# 3.1 Check for `ltp inspect` calls without a subcommand (trace|replay|explain|help)
# Avoid false-positives in prose: only flag when `inspect` is followed by a CLI flag (`--...`).
INSPECT_NO_SUBCOMMAND_HITS=$(
  grep -R --line-number -E \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=build \
    --exclude-dir=.turbo \
    --exclude="ci-guardrail.sh" \
    "^[[:space:]]*(pnpm[[:space:]]+)?ltp[[:space:]]+inspect([[:space:]]+--|[[:space:]]+--input|[[:space:]]+--format|[[:space:]]+--strict)" \
    docs examples scripts .github/workflows \
  | grep -vE "ltp inspect-report\\b" \
  | grep -vE "ltp inspect[[:space:]]+(trace|replay|explain|help)\\b" \
  | grep -vE "ltp inspect[[:space:]]+(--help|-h)\\b" \
  || true
)

INSPECT_PNPM_WRAPPER_NO_SUBCOMMAND_HITS=$(
  grep -R --line-number -E \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=build \
    --exclude-dir=.turbo \
    --exclude-dir=.next \
    --exclude="ci-guardrail.sh" \
    "^[[:space:]]*pnpm[[:space:]]+-w[[:space:]]+ltp:inspect[[:space:]]+--[[:space:]]+(--input|--format|--strict|--pretty|--quiet|--color)\\b" \
    docs examples scripts .github/workflows \
  | grep -vE "pnpm[[:space:]]+-w[[:space:]]+ltp:inspect[[:space:]]+--[[:space:]]+(trace|replay|explain|help)\\b" \
  | grep -vE "pnpm[[:space:]]+-w[[:space:]]+ltp:inspect[[:space:]]+--[[:space:]]+(--help|-h)\\b" \
  || true
)

if [ -n "$INSPECT_NO_SUBCOMMAND_HITS" ]; then
  echo "FAIL: Found 'ltp inspect' command usage without a subcommand."
  echo "Use: ltp inspect trace|replay|explain|help"
  echo ""
  echo "$INSPECT_NO_SUBCOMMAND_HITS"
  exit 1
fi

if [ -n "$INSPECT_PNPM_WRAPPER_NO_SUBCOMMAND_HITS" ]; then
  echo "FAIL: Found 'pnpm -w ltp:inspect --' usage without a subcommand."
  echo "Use: pnpm -w ltp:inspect -- trace|replay|explain|help"
  echo ""
  echo "$INSPECT_PNPM_WRAPPER_NO_SUBCOMMAND_HITS"
  exit 1
fi

echo "Guardrail checks passed!"
exit 0

#!/bin/bash
set -e

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
if grep -R --line-number --fixed-strings "canonical-clean.json" . \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=.turbo \
  --exclude="ci-guardrail.sh" --exclude="CHANGELOG.md" > /dev/null; then
  echo "FAIL: Found references to canonical-clean.json. Please update to canonical-linear.jsonl"
  grep -R --line-number --fixed-strings "canonical-clean.json" . \
    --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=.turbo \
    --exclude="ci-guardrail.sh" --exclude="CHANGELOG.md"
  exit 1
fi

# 2.5 Check for legacy --input *.json usage (trace inputs must be .jsonl)
# We only scan places where humans copy/paste commands: docs/, examples/, scripts/, workflows
# We exclude schema files and common JSON configs.
LEGACY_INPUT_JSON_HITS=$(
  grep -R --line-number --extended-regexp -- "--input" \
    .github/workflows docs examples scripts \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=build \
    --exclude-dir=.turbo \
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
if grep -R --line-number "ltp-inspect" docs examples scripts .github/workflows \
  --exclude-dir=.git --exclude-dir=node_modules --exclude="ci-guardrail.sh" > /dev/null; then
  # Filter out schema/contract references and file paths (tools/ltp-inspect)
  if grep -R --line-number "ltp-inspect" docs examples scripts .github/workflows \
    --exclude-dir=node_modules --exclude="ci-guardrail.sh" \
    | grep -v "schema.json" \
    | grep -v "contract" \
    | grep -v "ltp-inspect.v1.md" \
    | grep -v "tools/ltp-inspect" \
    > /dev/null; then
    echo "FAIL: Found references to legacy 'ltp-inspect'. Please use 'ltp inspect'."
    grep -R --line-number "ltp-inspect" docs examples scripts .github/workflows \
      --exclude-dir=node_modules --exclude="ci-guardrail.sh" \
      | grep -v "schema.json" \
      | grep -v "contract" \
      | grep -v "ltp-inspect.v1.md" \
      | grep -v "tools/ltp-inspect"
    exit 1
  fi
fi

# 4. Check for `ltp inspect` calls without a subcommand (trace|replay|explain|help)
INSPECT_NO_SUBCOMMAND_HITS=$(
  grep -R --line-number -E "^[[:space:]]*(pnpm[[:space:]]+)?ltp inspect" docs examples scripts .github/workflows \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=build \
    --exclude-dir=.turbo \
  | grep -vE "ltp inspect[[:space:]]+(trace|replay|explain|help)\\b" \
  | grep -vE "ltp inspect[[:space:]]+--help\\b" \
  | grep -vE "ltp inspect[[:space:]]+-h\\b" \
  || true
)

if [ -n "$INSPECT_NO_SUBCOMMAND_HITS" ]; then
  echo "FAIL: Found 'ltp inspect' calls without a subcommand. Use: ltp inspect trace|replay|explain|help"
  echo "$INSPECT_NO_SUBCOMMAND_HITS"
  exit 1
fi

echo "Guardrail checks passed!"
exit 0

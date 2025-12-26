#!/bin/bash
set -e

# Fail if forbidden patterns exist
echo "Checking for forbidden patterns..."

# 1. Check for .trace.json files (excluding .jsonl)
# We ignore .gitignore or other config files that might list them as exclusions
FOUND_TRACE_JSON=$(find . -name "*.trace.json" | grep -v ".jsonl" || true)
if [ -n "$FOUND_TRACE_JSON" ]; then
  echo "FAIL: Found .trace.json files. Please rename to .trace.jsonl"
  echo "$FOUND_TRACE_JSON"
  exit 1
fi

# 2. Check for canonical-clean.json references (should be canonical-linear.jsonl)
# Excluding the script itself, git, and CHANGELOG.md (for historical reference)
if grep -r "canonical-clean.json" . --exclude-dir=.git --exclude="ci-guardrail.sh" --exclude="CHANGELOG.md" > /dev/null; then
  echo "FAIL: Found references to canonical-clean.json. Please update to canonical-linear.jsonl"
  grep -r "canonical-clean.json" . --exclude-dir=.git --exclude="ci-guardrail.sh" --exclude="CHANGELOG.md"
  exit 1
fi

# 3. Check for deprecated `ltp-inspect` usage in docs and examples
if grep -r "ltp-inspect" docs examples --exclude-dir=.git > /dev/null; then
  # Filter out schema/contract references and file paths (tools/ltp-inspect)
  if grep -r "ltp-inspect" docs examples | grep -v "schema.json" | grep -v "contract" | grep -v "ltp-inspect.v1.md" | grep -v "tools/ltp-inspect"; then
      echo "FAIL: Found references to legacy 'ltp-inspect' in docs/examples. Please use 'ltp inspect'."
      grep -r "ltp-inspect" docs examples | grep -v "schema.json" | grep -v "contract" | grep -v "ltp-inspect.v1.md" | grep -v "tools/ltp-inspect"
      exit 1
  fi
fi

echo "Guardrail checks passed!"
exit 0

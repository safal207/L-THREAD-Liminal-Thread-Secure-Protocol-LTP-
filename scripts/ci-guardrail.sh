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

echo "Guardrail checks passed!"
exit 0

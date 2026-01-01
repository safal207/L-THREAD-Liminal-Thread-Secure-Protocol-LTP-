#!/bin/bash
set -e
set -u

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
if grep -RFn "canonical-clean.json" . \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=.turbo \
  --exclude="ci-guardrail.sh" --exclude="CHANGELOG.md" > /dev/null; then
  echo "FAIL: Found references to canonical-clean.json. Please update to canonical-linear.jsonl"
  grep -RFn "canonical-clean.json" . \
    --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=.turbo \
    --exclude="ci-guardrail.sh" --exclude="CHANGELOG.md"
  exit 1
fi

# 2.5 Check for legacy --input *.json usage (trace inputs must be .jsonl)
# We only scan places where humans copy/paste commands: docs/, examples/, scripts/, workflows
# We exclude schema files and common JSON configs.
LEGACY_INPUT_JSON_HITS=$(
  grep -R --line-number --fixed-strings -- "--input" \
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

# 3. Check for deprecated `ltp-inspect` usage in docs and examples
if grep -R --line-number "ltp-inspect" docs examples --exclude-dir=.git --exclude-dir=node_modules > /dev/null; then
  # Filter out schema/contract references and file paths (tools/ltp-inspect)
  if grep -R --line-number "ltp-inspect" docs examples --exclude-dir=node_modules \
    | grep -v "schema.json" \
    | grep -v "contract" \
    | grep -v "ltp-inspect.v1.md" \
    | grep -v "tools/ltp-inspect" \
    > /dev/null; then
    echo "FAIL: Found references to legacy 'ltp-inspect' in docs/examples. Please use 'ltp inspect'."
    grep -R --line-number "ltp-inspect" docs examples --exclude-dir=node_modules \
      | grep -v "schema.json" \
      | grep -v "contract" \
      | grep -v "ltp-inspect.v1.md" \
      | grep -v "tools/ltp-inspect"
    exit 1
  fi
fi

# 4. Enforce two-digit canon numbering (00-, 07-, 10-, ...)
NON_TWO_DIGIT_ACTS=$(
  find docs/canon -maxdepth 1 -type f -name "[0-9]-*.md" -print 2>/dev/null || true
)
if [ -n "$NON_TWO_DIGIT_ACTS" ]; then
  echo "FAIL: Canon acts must use two-digit numbering (e.g., 00-, 07-, 10-)."
  echo "$NON_TWO_DIGIT_ACTS"
  exit 1
fi

# 5. Canon guardrail checks
CANON_MAP="docs/contracts/CANON_MAP.md"
REQUIREMENTS="docs/contracts/REQUIREMENTS.md"
INSPECT_SCHEMA="docs/contracts/ltp-inspect.v1.schema.json"

if [ ! -f "$CANON_MAP" ]; then
  echo "FAIL: Missing $CANON_MAP for canon guardrail."
  exit 1
fi

if [ ! -f "$REQUIREMENTS" ]; then
  echo "FAIL: Missing $REQUIREMENTS for canon guardrail."
  exit 1
fi

if [ ! -f "$INSPECT_SCHEMA" ]; then
  echo "FAIL: Missing $INSPECT_SCHEMA for canon guardrail."
  exit 1
fi

CANON_FILES=$(
  find docs/canon -maxdepth 1 -type f -name "[0-9][0-9]-*.md" -print 2>/dev/null || true
)
if [ -z "$CANON_FILES" ]; then
  echo "FAIL: No canon act files found in docs/canon."
  exit 1
fi

for CANON_FILE in $CANON_FILES; do
  if ! grep -F "$CANON_FILE" "$CANON_MAP" > /dev/null; then
    echo "FAIL: Canon act missing from CANON_MAP: $CANON_FILE"
    exit 1
  fi
done

# Only canon-bound requirements must appear in CANON_MAP.
# Source of truth: x-canonRefs in the Inspector contract schema.
# This keeps CANON_MAP focused and prevents CI from forcing tool-only / enterprise-only reqs into canon mapping.

CANON_REQ_IDS=$(
  node -e "
    const fs = require('fs');
    const p = process.argv[1];
    const s = JSON.parse(fs.readFileSync(p, 'utf8'));
    const refs = Array.isArray(s['x-canonRefs']) ? s['x-canonRefs'] : [];
    for (const r of refs) console.log(String(r));
  " "$INSPECT_SCHEMA" 2>/dev/null | sort -u || true
)

if [ -z "$CANON_REQ_IDS" ]; then
  echo "FAIL: No x-canonRefs found in $INSPECT_SCHEMA (canon-bound requirements unknown)."
  exit 1
fi

# Ensure each canon-bound requirement exists in REQUIREMENTS.md
for REQ_ID in $CANON_REQ_IDS; do
  if ! grep -F "$REQ_ID" "$REQUIREMENTS" > /dev/null; then
    echo "FAIL: Canon requirement referenced by schema but missing from REQUIREMENTS: $REQ_ID"
    exit 1
  fi
done

# Ensure each canon-bound requirement is mapped in CANON_MAP.md
for REQ_ID in $CANON_REQ_IDS; do
  if ! grep -F "$REQ_ID" "$CANON_MAP" > /dev/null; then
    echo "FAIL: Canon requirement missing from CANON_MAP: $REQ_ID"
    exit 1
  fi
done

echo "Guardrail checks passed!"
exit 0

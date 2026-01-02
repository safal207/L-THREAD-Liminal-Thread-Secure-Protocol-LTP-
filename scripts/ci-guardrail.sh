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
  grep -R --line-number --extended-regexp --fixed-strings -- "--input" \
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

# 4. Check for canon acts using non-two-digit numbering.
NON_TWO_DIGIT_ACTS=$(
  find docs/canon -maxdepth 1 -type f -name "[0-9]-*.md" -print 2>/dev/null || true
)
if [ -n "$NON_TWO_DIGIT_ACTS" ]; then
  echo "FAIL: Canon acts must use two-digit numbering (e.g., 00-, 07-, 10-)."
  echo "$NON_TWO_DIGIT_ACTS"
  exit 1
fi

CANON_ACTS=$(
  find docs/canon -maxdepth 1 -type f -name "[0-9][0-9]-*.md" -print 2>/dev/null || true
)
if [ -z "$CANON_ACTS" ]; then
  echo "FAIL: No canon act files found (expected docs/canon/[0-9][0-9]-*.md)."
  exit 1
fi

# 5. Ensure every canon act is mapped in CANON_MAP
CANON_MAP="docs/contracts/CANON_MAP.md"

if [ ! -f "$CANON_MAP" ]; then
  echo "FAIL: Missing $CANON_MAP for canon guardrail."
  exit 1
fi

for CANON_FILE in $CANON_ACTS; do
  if ! grep -F "$CANON_FILE" "$CANON_MAP" > /dev/null; then
    echo "FAIL: Canon act missing from CANON_MAP: $CANON_FILE"
    exit 1
  fi
done

# 6. Ensure x-canonRefs exist and map to REQUIREMENTS and CANON_MAP
CANON_SCHEMA="docs/contracts/ltp-inspect.v1.schema.json"
REQUIREMENTS="docs/contracts/REQUIREMENTS.md"

if [ ! -f "$CANON_SCHEMA" ]; then
  echo "FAIL: Missing $CANON_SCHEMA for canon guardrail."
  exit 1
fi

if [ ! -f "$REQUIREMENTS" ]; then
  echo "FAIL: Missing $REQUIREMENTS for canon guardrail."
  exit 1
fi

CANON_REFS=$(
  python - <<'PY'
import json
from pathlib import Path

schema_path = Path("docs/contracts/ltp-inspect.v1.schema.json")
data = json.loads(schema_path.read_text(encoding="utf-8"))
refs = data.get("x-canonRefs", [])
if not isinstance(refs, list):
    refs = []
for ref in refs:
    if isinstance(ref, str):
        print(ref)
PY
)

if [ -z "$CANON_REFS" ]; then
  echo "FAIL: Missing or empty x-canonRefs in $CANON_SCHEMA."
  exit 1
fi

for CANON_REF in $CANON_REFS; do
  if ! grep -F "$CANON_REF" "$REQUIREMENTS" > /dev/null; then
    echo "FAIL: Canon ref missing from REQUIREMENTS: $CANON_REF"
    exit 1
  fi
  if ! grep -F "$CANON_REF" "$CANON_MAP" > /dev/null; then
    echo "FAIL: Canon ref missing from CANON_MAP: $CANON_REF"
    exit 1
  fi
done

echo "Guardrail checks passed!"
exit 0

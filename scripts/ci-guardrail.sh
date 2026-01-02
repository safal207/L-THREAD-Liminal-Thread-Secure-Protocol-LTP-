#!/bin/bash
set -euo pipefail

# Fail if forbidden patterns exist
echo "Checking for forbidden patterns..."

# 1) Check for .trace.json files (excluding .jsonl)
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

# 2) Check for canonical-clean.json references (should be canonical-linear.jsonl)
# Excluding the script itself, git, and CHANGELOG.md (for historical reference)
if grep -R --line-number --fixed-strings "canonical-clean.json" . \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=build \
  --exclude-dir=.turbo \
  --exclude-dir=.next \
  --exclude="scripts/ci-guardrail.sh" \
  --exclude="CHANGELOG.md" \
  > /dev/null; then
  echo "FAIL: Found deprecated reference 'canonical-clean.json'. Please use 'canonical-linear.jsonl'."
  grep -R --line-number --fixed-strings "canonical-clean.json" . \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude="scripts/ci-guardrail.sh" \
    --exclude="CHANGELOG.md"
  exit 1
fi

# 2b) Check for legacy --input <file>.json usage (trace inputs must be .jsonl)
# Scan only copy/paste surfaces: docs/examples/scripts/workflows/site
LEGACY_INPUT_JSON_HITS=$(
  grep -R --line-number --fixed-strings -- "--input" \
    docs examples scripts .github/workflows site 2>/dev/null \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=build \
    --exclude-dir=.turbo \
    --exclude-dir=.next \
    --exclude="scripts/ci-guardrail.sh" \
  | grep -E -- "--input(=|[[:space:]]+)[^[:space:]]+\.json([[:space:]]|$)" \
  | grep -vE "\.schema\.json([[:space:]]|$)" \
  | grep -vE "package\.json([[:space:]]|$)" \
  | grep -vE "tsconfig\.json([[:space:]]|$)" \
  | grep -vE "eslint.*\.json([[:space:]]|$)" \
  | grep -vE "prettier.*\.json([[:space:]]|$)" \
  || true
)

if [ -n "$LEGACY_INPUT_JSON_HITS" ]; then
  echo "FAIL: Found legacy '--input <file>.json' usage. Use JSONL: --input <file>.jsonl"
  echo ""
  echo "$LEGACY_INPUT_JSON_HITS"
  exit 1
fi

# 3) Check for deprecated `ltp-inspect` usage (use `ltp inspect`)
SEARCH_DIRS="docs examples scripts .github/workflows site"

# If these dirs don't exist in some env, grep will error; guard it.
EXISTING_DIRS=""
for d in $SEARCH_DIRS; do
  if [ -e "$d" ]; then
    EXISTING_DIRS="$EXISTING_DIRS $d"
  fi
done

if [ -n "$EXISTING_DIRS" ]; then
  if grep -R --line-number "ltp-inspect" $EXISTING_DIRS --exclude-dir=node_modules --exclude="ci-guardrail.sh" > /dev/null 2>&1; then
    # Filter out schema/contract references and file paths (tools/ltp-inspect)
    if grep -R --line-number "ltp-inspect" $EXISTING_DIRS --exclude-dir=node_modules --exclude="ci-guardrail.sh" \
      | grep -v "schema.json" \
      | grep -v "contract" \
      | grep -v "ltp-inspect.v1.md" \
      | grep -v "tools/ltp-inspect" \
      > /dev/null; then
      echo "FAIL: Found references to legacy 'ltp-inspect'. Please use 'ltp inspect'."
      grep -R --line-number "ltp-inspect" $EXISTING_DIRS --exclude-dir=node_modules --exclude="ci-guardrail.sh" \
        | grep -v "schema.json" \
        | grep -v "contract" \
        | grep -v "ltp-inspect.v1.md" \
        | grep -v "tools/ltp-inspect"
      exit 1
    fi
  fi

  # 3b) Disallow `ltp inspect` without a subcommand (trace|replay|explain|help)
  # This catches copy-paste commands that omit the actual subcommand.
  if grep -R --line-number -E "\bltp[[:space:]]+inspect\b" $EXISTING_DIRS --exclude-dir=node_modules --exclude="ci-guardrail.sh" > /dev/null 2>&1; then
    BAD_INSPECT=$(
      grep -R --line-number -E "\bltp[[:space:]]+inspect\b" $EXISTING_DIRS --exclude-dir=node_modules --exclude="ci-guardrail.sh" \
        | grep -v -E "\bltp[[:space:]]+inspect[[:space:]]+(trace|replay|explain|help)\b" \
        || true
    )
    if [ -n "$BAD_INSPECT" ]; then
      echo "FAIL: Found 'ltp inspect' without a subcommand."
      echo "Use: ltp inspect trace|replay|explain|help ..."
      echo ""
      echo "$BAD_INSPECT"
      exit 1
    fi
  fi
fi

# 3.75 Enforce: docs/canon contains ONLY Acts + README
CANON_EXTRA_MD=$(
  find docs/canon -maxdepth 1 -type f -name "*.md" \
    ! -name "README.md" \
    ! -name "[0-9][0-9]-*.md" \
    -print 2>/dev/null || true
)
if [ -n "$CANON_EXTRA_MD" ]; then
  echo "FAIL: docs/canon/ must contain only README.md and two-digit Act files ([0-9][0-9]-*.md)."
  echo "Move non-Act documents to docs/guardrails/ (or elsewhere). Found:"
  echo ""
  echo "$CANON_EXTRA_MD"
  exit 1
fi

# 4) Check for canon acts using non-two-digit numbering.
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

# 5) Ensure every canon act is mapped in CANON_MAP
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

# 6) Ensure x-canonRefs exist and map to REQUIREMENTS and CANON_MAP
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

if ! command -v node >/dev/null 2>&1; then
  echo "FAIL: 'node' is required for canon guardrail (parsing x-canonRefs)."
  exit 1
fi

CANON_REFS=$(
  node -e "
    const fs = require('fs');
    const p = 'docs/contracts/ltp-inspect.v1.schema.json';
    const s = JSON.parse(fs.readFileSync(p, 'utf8'));
    const refs = Array.isArray(s['x-canonRefs']) ? s['x-canonRefs'] : [];
    for (const r of refs) if (typeof r === 'string') console.log(r);
  " 2>/dev/null || true
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

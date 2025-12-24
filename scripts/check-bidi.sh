#!/bin/bash
set -e

# Define the forbidden characters pattern (PCRE)
# U+202A..U+202E (Bidi controls)
# U+2066..U+2069 (Bidi controls)
# U+200B..U+200F (Zero width)
# U+FEFF (BOM)
# U+00AD (Soft hyphen)
PATTERN="[\x{202A}-\x{202E}\x{2066}-\x{2069}\x{200B}-\x{200F}\x{FEFF}\x{00AD}]"

echo "Scanning for forbidden hidden/bidi Unicode characters..."

# We use grep with PCRE (-P) to find these characters.
# We exclude .git directory and node_modules
# We verify if any match is found.

if grep -rP "$PATTERN" . --exclude-dir={.git,node_modules,dist,build,coverage} --exclude=check-bidi.sh; then
    echo "❌ ERROR: Forbidden Unicode characters found!"
    exit 1
else
    echo "✅ No forbidden Unicode characters found."
    exit 0
fi

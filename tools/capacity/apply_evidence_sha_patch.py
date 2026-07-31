#!/usr/bin/env python3
from pathlib import Path

path = Path("tools/capacity/run.ts")
text = path.read_text(encoding="utf-8")
old = '    source_sha: process.env.GITHUB_SHA || process.env.LTP_SOURCE_SHA || "local",\n'
new = '    source_sha: process.env.LTP_SOURCE_SHA || process.env.GITHUB_SHA || "local",\n'
if text.count(old) != 1:
    raise SystemExit(f"expected one source_sha match, found {text.count(old)}")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("WP4 exact evidence SHA patch applied")

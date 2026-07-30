#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    if new in text:
        return
    if text.count(old) != 1:
        raise RuntimeError(f"{path}: expected one match, found {text.count(old)}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "tests/e2e/four-sdk/javascript_adapter.ts",
    "reconnect: { enabled: false, maxRetries: 0, baseDelayMs: 50, maxDelayMs: 50 },",
    "reconnect: { maxRetries: 0, baseDelayMs: 50, maxDelayMs: 50 },",
)

print("WP2 adapter compatibility fixes applied")

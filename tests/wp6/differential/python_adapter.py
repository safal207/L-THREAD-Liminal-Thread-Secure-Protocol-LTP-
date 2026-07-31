from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from typing import Any

from ltp_client.crypto import _serialize_canonical


def value_depth(value: Any, depth: int = 0) -> int:
    if isinstance(value, list):
        return max([depth + 1, *(value_depth(item, depth + 1) for item in value)])
    if isinstance(value, dict):
        return max([depth + 1, *(value_depth(item, depth + 1) for item in value.values())])
    return depth


def classify(entry: dict[str, Any], limits: dict[str, int]) -> dict[str, Any]:
    base = {"id": entry["id"], "category": entry["category"]}
    raw = entry["raw_json"]
    if len(raw.encode("utf-8")) > limits["max_input_bytes"]:
        return {**base, "verdict": "REJECTED", "reason": "INPUT_TOO_LARGE"}
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, UnicodeError):
        return {**base, "verdict": "REJECTED", "reason": "INVALID_JSON"}
    if value_depth(parsed) > limits["max_depth"]:
        return {**base, "verdict": "REJECTED", "reason": "MAX_DEPTH_EXCEEDED"}
    if not isinstance(parsed, dict):
        return {**base, "verdict": "REJECTED", "reason": "CANONICAL_REJECTED"}
    try:
        canonical = _serialize_canonical(parsed)
    except (TypeError, ValueError, OverflowError, RecursionError):
        return {**base, "verdict": "REJECTED", "reason": "CANONICAL_REJECTED"}
    return {
        **base,
        "verdict": "ACCEPTED",
        "reason": "ACCEPTED",
        "canonical_digest": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
    }


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: python_adapter.py <corpus.json> <output.json>")
    corpus_path, output_path = map(Path, sys.argv[1:])
    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    report = {
        "schema_version": 1,
        "profile": "org.ltp.wp6.sdk-differential-report.v1",
        "sdk": "python",
        "corpus_digest": corpus["corpus_digest"],
        "limits": corpus["limits"],
        "results": [classify(entry, corpus["limits"]) for entry in corpus["cases"]],
    }
    output_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

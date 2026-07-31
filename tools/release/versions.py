#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
POLICY_PATH = ROOT / "config/release/release-policy.json"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def require_match(path: Path, pattern: str, label: str) -> str:
    text = path.read_text(encoding="utf-8")
    match = re.search(pattern, text, flags=re.MULTILINE)
    if not match:
        raise ValueError(f"could not extract {label} from {path.relative_to(ROOT)}")
    return match.group(1)


def collect_versions() -> dict[str, Any]:
    policy = read_json(POLICY_PATH)
    baseline_path = ROOT / policy["version_source"]
    baseline = read_json(baseline_path)
    expected = baseline["sdk_version"]

    versions = {
        "javascript": read_json(ROOT / "sdk/js/package.json")["version"],
        "python": require_match(
            ROOT / "sdk/python/setup.py",
            r"^\s*version\s*=\s*[\"']([^\"']+)[\"']",
            "Python version",
        ),
        "rust": require_match(
            ROOT / "sdk/rust/ltp-client/Cargo.toml",
            r"^version\s*=\s*\"([^\"]+)\"",
            "Rust version",
        ),
        "elixir": require_match(
            ROOT / "sdk/elixir/mix.exs",
            r"^\s*@version\s+\"([^\"]+)\"",
            "Elixir version",
        ),
    }
    mismatches = {sdk: version for sdk, version in versions.items() if version != expected}
    protocol_version = expected.split("-", 1)[0]
    return {
        "schema_version": 1,
        "profile": "org.ltp.release.version-evidence.v1",
        "version_source": str(baseline_path.relative_to(ROOT)),
        "release_version": expected,
        "protocol_version": protocol_version,
        "sdk_versions": versions,
        "consistent": not mismatches,
        "mismatches": mismatches,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()

    evidence = collect_versions()
    payload = json.dumps(evidence, indent=2, sort_keys=True) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(payload, encoding="utf-8")
    else:
        print(payload, end="")

    if not evidence["consistent"]:
        raise SystemExit(f"SDK version drift: {evidence['mismatches']}")


if __name__ == "__main__":
    main()

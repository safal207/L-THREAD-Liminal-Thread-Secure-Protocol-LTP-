#!/usr/bin/env python3
"""Validate the machine-readable LTP production-readiness baseline and its report."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "tests/production/readiness-baseline.json"
REPORT_PATH = ROOT / "docs/production/READINESS_BASELINE.md"
SDK_ORDER = ("javascript", "python", "rust", "elixir")
ALLOWED_STATUSES = {"PROVEN", "PARTIAL", "MISSING", "STALE", "NOT_APPLICABLE"}


def load_manifest() -> dict[str, Any]:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def extract_versions() -> dict[str, str]:
    js = json.loads((ROOT / "sdk/js/package.json").read_text(encoding="utf-8"))["version"]
    python_setup = (ROOT / "sdk/python/setup.py").read_text(encoding="utf-8")
    cargo = (ROOT / "sdk/rust/ltp-client/Cargo.toml").read_text(encoding="utf-8")
    mix = (ROOT / "sdk/elixir/mix.exs").read_text(encoding="utf-8")

    python_match = re.search(r'\bversion\s*=\s*"([^"]+)"', python_setup)
    rust_match = re.search(r'^version\s*=\s*"([^"]+)"', cargo, re.MULTILINE)
    elixir_match = re.search(r'@version\s+"([^"]+)"', mix)
    if not python_match or not rust_match or not elixir_match:
        raise ValueError("Unable to extract one or more SDK versions")

    return {
        "javascript": js,
        "python": python_match.group(1),
        "rust": rust_match.group(1),
        "elixir": elixir_match.group(1),
    }


def validate(manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if manifest.get("schema_version") != 1:
        errors.append("schema_version must be 1")

    captured = str(manifest.get("captured_from_commit", ""))
    if not re.fullmatch(r"[0-9a-f]{40}", captured):
        errors.append("captured_from_commit must be a full lowercase SHA-1")

    declared_version = manifest.get("sdk_version")
    for sdk, actual in extract_versions().items():
        if actual != declared_version:
            errors.append(f"{sdk} version drift: manifest={declared_version!r}, actual={actual!r}")

    sdks = manifest.get("sdks", {})
    if tuple(sdks.keys()) != SDK_ORDER:
        errors.append(f"sdks must be ordered exactly as {SDK_ORDER}")
    for sdk in SDK_ORDER:
        entry = sdks.get(sdk, {})
        for field in ("manifest", "runtime", "test"):
            if not entry.get(field):
                errors.append(f"sdks.{sdk}.{field} is required")
        path = ROOT / str(entry.get("manifest", ""))
        if not path.is_file():
            errors.append(f"SDK manifest does not exist: {path.relative_to(ROOT)}")

    workflow_ids: set[str] = set()
    for workflow in manifest.get("workflows", []):
        workflow_id = workflow.get("id")
        if not workflow_id or workflow_id in workflow_ids:
            errors.append(f"workflow id must be unique and non-empty: {workflow_id!r}")
        workflow_ids.add(workflow_id)
        path = ROOT / str(workflow.get("path", ""))
        if not path.is_file():
            errors.append(f"workflow evidence does not exist: {path.relative_to(ROOT)}")
        if workflow.get("status") not in ALLOWED_STATUSES:
            errors.append(f"invalid workflow status for {workflow_id}: {workflow.get('status')}")

    capability_ids: set[str] = set()
    for capability in manifest.get("capabilities", []):
        capability_id = capability.get("id")
        if not capability_id or capability_id in capability_ids:
            errors.append(f"capability id must be unique and non-empty: {capability_id!r}")
        capability_ids.add(capability_id)
        if not capability.get("claim"):
            errors.append(f"capability {capability_id} has no claim")

        statuses = capability.get("status_by_sdk", {})
        if tuple(statuses.keys()) != SDK_ORDER:
            errors.append(f"capability {capability_id} must list SDKs in canonical order")
        for sdk in SDK_ORDER:
            if statuses.get(sdk) not in ALLOWED_STATUSES:
                errors.append(f"capability {capability_id}/{sdk} has invalid status")

        evidence = capability.get("evidence", [])
        if all(status == "PROVEN" for status in statuses.values()) and not evidence:
            errors.append(f"fully PROVEN capability {capability_id} must have evidence")
        for relative_path in evidence:
            if not (ROOT / relative_path).exists():
                errors.append(f"capability {capability_id} evidence missing: {relative_path}")

        if any(status in {"PARTIAL", "MISSING", "STALE"} for status in statuses.values()):
            if not capability.get("remaining_gap"):
                errors.append(f"capability {capability_id} needs a remaining_gap")

    reconciled: set[int] = set()
    for item in manifest.get("issue_reconciliation", []):
        issue = item.get("issue")
        if not isinstance(issue, int) or issue in reconciled:
            errors.append(f"reconciled issue must be a unique integer: {issue!r}")
        reconciled.add(issue)
        if item.get("assessment") not in ALLOWED_STATUSES:
            errors.append(f"issue #{issue} has invalid assessment")
        if item.get("disposition") not in {"CLOSE", "NARROW", "KEEP_OPEN"}:
            errors.append(f"issue #{issue} has invalid disposition")
        if not item.get("reason"):
            errors.append(f"issue #{issue} has no reason")
    if reconciled != {419, 420, 425}:
        errors.append("issue reconciliation must cover exactly #419, #420 and #425")

    if not manifest.get("open_gaps"):
        errors.append("open_gaps must not be empty")

    report = REPORT_PATH.read_text(encoding="utf-8") if REPORT_PATH.exists() else ""
    required_report_tokens = [
        manifest.get("baseline_id", ""),
        manifest.get("captured_from_commit", ""),
        str(manifest.get("sdk_version", "")),
        "generated from `tests/production/readiness-baseline.json`",
    ]
    required_report_tokens.extend(f"`{capability_id}`" for capability_id in capability_ids)
    required_report_tokens.extend(f"`{workflow_id}`" for workflow_id in workflow_ids)
    required_report_tokens.extend(f"#{issue}" for issue in reconciled)
    for token in required_report_tokens:
        if token and token not in report:
            errors.append(f"readiness report is stale or incomplete; missing token: {token}")

    archived = (ROOT / "SECURITY_SYNC_STATUS.md").read_text(encoding="utf-8")
    if "Archived" not in archived or "READINESS_BASELINE.md" not in archived:
        errors.append("SECURITY_SYNC_STATUS.md must be an archived pointer to the baseline")

    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    if "docs/production/READINESS_BASELINE.md" not in readme:
        errors.append("README must link to the production-readiness baseline")

    return errors


def main() -> int:
    manifest = load_manifest()
    errors = validate(manifest)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("Readiness baseline is valid, evidence-linked and synchronized with SDK versions.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ltp.inspect_trace import evaluate_record

VALID_LABELS = ("admissible", "drift", "rejected")
UNEXPECTED_LABEL = "unexpected"
VALID_PROVENANCE_STATUS = {"complete", "partial", "broken"}
VALID_ANCHOR_SUPPORT = {"direct", "weak", "mismatch"}


@dataclass(frozen=True)
class BenchmarkCase:
    name: str
    expected_label: str
    phase: str
    note: str
    record: dict[str, Any]


@dataclass(frozen=True)
class CaseResult:
    name: str
    expected_label: str
    predicted_label: str
    passed: bool
    reason: str
    note: str


@dataclass(frozen=True)
class BenchmarkSummary:
    total_cases: int
    correct_classifications: int
    mismatches: int
    counts_by_expected: dict[str, int]
    counts_by_predicted: dict[str, int]


def _validate_label(label: str, source: Path) -> str:
    if label not in VALID_LABELS:
        allowed = ", ".join(VALID_LABELS)
        raise ValueError(f"Invalid expected_label '{label}' in {source}. Allowed: {allowed}")
    return label


def _validate_required_fields(payload: dict[str, Any], source: Path) -> None:
    for field in ("case_id", "expected_label", "phase", "record"):
        if field not in payload:
            raise ValueError(f"Missing required field '{field}' in {source}")

    record = payload["record"]
    if not isinstance(record, dict):
        raise ValueError(f"record must be a JSON object in {source}")

    for field in ("input", "output", "anchors"):
        if field not in record:
            raise ValueError(f"Missing required record field '{field}' in {source}")

    if "approval_present" in record and not isinstance(record["approval_present"], bool):
        raise ValueError(f"record.approval_present must be boolean in {source}")

    if "unsupported_step_present" in record and not isinstance(record["unsupported_step_present"], bool):
        raise ValueError(f"record.unsupported_step_present must be boolean in {source}")

    if "provenance_status" in record and str(record["provenance_status"]) not in VALID_PROVENANCE_STATUS:
        allowed = ", ".join(sorted(VALID_PROVENANCE_STATUS))
        raise ValueError(f"record.provenance_status must be one of [{allowed}] in {source}")

    if "anchor_support" in record and str(record["anchor_support"]) not in VALID_ANCHOR_SUPPORT:
        allowed = ", ".join(sorted(VALID_ANCHOR_SUPPORT))
        raise ValueError(f"record.anchor_support must be one of [{allowed}] in {source}")


def _normalize_predicted_label(label: str) -> str:
    return label if label in VALID_LABELS else UNEXPECTED_LABEL


def load_fixture_cases(fixtures_root: str | Path) -> list[BenchmarkCase]:
    root = Path(fixtures_root)
    if not root.exists():
        raise FileNotFoundError(f"Fixture directory does not exist: {root}")

    cases: list[BenchmarkCase] = []
    for fixture_path in sorted(root.rglob("*.json")):
        payload = json.loads(fixture_path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError(f"Fixture must be a JSON object in {fixture_path}")

        _validate_required_fields(payload, fixture_path)
        expected_label = _validate_label(str(payload["expected_label"]), fixture_path)
        phase = str(payload["phase"])
        note = str(payload.get("note", ""))
        record = payload["record"]

        cases.append(
            BenchmarkCase(
                name=str(payload["case_id"]),
                expected_label=expected_label,
                phase=phase,
                note=note,
                record=record,
            )
        )
    return cases


def evaluate_case(case: BenchmarkCase) -> CaseResult:
    decision = evaluate_record(case.record, phase=case.phase)
    predicted = _normalize_predicted_label(decision.decision)
    return CaseResult(
        name=case.name,
        expected_label=case.expected_label,
        predicted_label=predicted,
        passed=(predicted == case.expected_label),
        reason=decision.reason,
        note=case.note,
    )


def summarize_results(results: list[CaseResult]) -> BenchmarkSummary:
    counts_by_expected = Counter(result.expected_label for result in results)
    counts_by_predicted = Counter(result.predicted_label for result in results)
    correct = sum(1 for result in results if result.passed)

    predicted_labels = (*VALID_LABELS, UNEXPECTED_LABEL)
    return BenchmarkSummary(
        total_cases=len(results),
        correct_classifications=correct,
        mismatches=len(results) - correct,
        counts_by_expected={label: counts_by_expected.get(label, 0) for label in VALID_LABELS},
        counts_by_predicted={label: counts_by_predicted.get(label, 0) for label in predicted_labels},
    )


def run_benchmark(fixtures_root: str | Path) -> tuple[list[CaseResult], BenchmarkSummary]:
    cases = load_fixture_cases(fixtures_root)
    results = [evaluate_case(case) for case in cases]
    summary = summarize_results(results)
    return results, summary


def render_report(results: list[CaseResult], summary: BenchmarkSummary) -> str:
    lines: list[str] = ["LTP safety-eval benchmark scaffold", ""]
    for result in results:
        status = "PASS" if result.passed else "FAIL"
        note = f" note={result.note}" if result.note else ""
        lines.append(
            f"- {result.name}: expected={result.expected_label} predicted={result.predicted_label} "
            f"status={status} reason={result.reason}{note}"
        )

    lines.extend(
        [
            "",
            "Summary:",
            f"- total cases: {summary.total_cases}",
            f"- correct classifications: {summary.correct_classifications}",
            f"- mismatches: {summary.mismatches}",
            "- counts by expected label: "
            + ", ".join(f"{label}={summary.counts_by_expected[label]}" for label in VALID_LABELS),
            "- counts by predicted label: "
            + ", ".join(
                f"{label}={summary.counts_by_predicted[label]}"
                for label in (*VALID_LABELS, UNEXPECTED_LABEL)
            ),
        ]
    )

    return "\n".join(lines)


def render_markdown_report(results: list[CaseResult], summary: BenchmarkSummary) -> str:
    lines: list[str] = [
        "# LTP Safety-Eval Benchmark Results",
        "",
        "Deterministic benchmark report generated from `benchmark/fixtures`.",
        "Interpretation guide: see `benchmark/INTERPRETATION.md` for scope and claims boundaries.",
        "",
        "## Summary",
        "",
        f"- Total cases: **{summary.total_cases}**",
        f"- Correct classifications: **{summary.correct_classifications}**",
        f"- Mismatches: **{summary.mismatches}**",
        "",
        "### Counts by expected label",
        "",
        "| label | count |",
        "|---|---:|",
        *(f"| {label} | {summary.counts_by_expected[label]} |" for label in VALID_LABELS),
        "",
        "### Counts by predicted label",
        "",
        "| label | count |",
        "|---|---:|",
        *(f"| {label} | {summary.counts_by_predicted[label]} |" for label in (*VALID_LABELS, UNEXPECTED_LABEL)),
        "",
        "## Per-case results",
        "",
        "| case_id | expected | predicted | status | reason |",
        "|---|---|---|---|---|",
    ]

    for result in results:
        status = "PASS" if result.passed else "FAIL"
        lines.append(
            f"| {result.name} | {result.expected_label} | {result.predicted_label} | {status} | {result.reason} |"
        )

    return "\n".join(lines) + "\n"

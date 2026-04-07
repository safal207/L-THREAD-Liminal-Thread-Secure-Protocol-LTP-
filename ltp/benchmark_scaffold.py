from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ltp.inspect_trace import evaluate_record

VALID_LABELS = ("admissible", "drift", "rejected")


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


def load_fixture_cases(fixtures_root: str | Path) -> list[BenchmarkCase]:
    root = Path(fixtures_root)
    if not root.exists():
        raise FileNotFoundError(f"Fixture directory does not exist: {root}")

    cases: list[BenchmarkCase] = []
    for fixture_path in sorted(root.rglob("*.json")):
        payload = json.loads(fixture_path.read_text(encoding="utf-8"))
        expected_label = _validate_label(str(payload["expected_label"]), fixture_path)
        phase = str(payload.get("phase", "two_phase"))
        note = str(payload.get("note", ""))
        record = payload.get("record", {})
        if not isinstance(record, dict):
            raise ValueError(f"record must be a JSON object in {fixture_path}")
        name = str(payload.get("case_id") or fixture_path.stem)
        cases.append(
            BenchmarkCase(
                name=name,
                expected_label=expected_label,
                phase=phase,
                note=note,
                record=record,
            )
        )
    return cases


def evaluate_case(case: BenchmarkCase) -> CaseResult:
    decision = evaluate_record(case.record, phase=case.phase)
    predicted = decision.decision
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

    return BenchmarkSummary(
        total_cases=len(results),
        correct_classifications=correct,
        mismatches=len(results) - correct,
        counts_by_expected={label: counts_by_expected.get(label, 0) for label in VALID_LABELS},
        counts_by_predicted={label: counts_by_predicted.get(label, 0) for label in VALID_LABELS},
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
        lines.append(
            f"- {result.name}: expected={result.expected_label} predicted={result.predicted_label} "
            f"status={status} reason={result.reason}"
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
            + ", ".join(f"{label}={summary.counts_by_predicted[label]}" for label in VALID_LABELS),
        ]
    )

    return "\n".join(lines)

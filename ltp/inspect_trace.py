from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass
class TraceDecision:
    timestamp: str
    decision: str
    reason: str
    input_text: str
    output_text: str
    anchors: list[str]


def _parse_jsonl(path: Path) -> Iterable[dict]:
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        stripped = line.strip()
        if not stripped:
            continue
        try:
            payload = json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON on line {line_number}: {exc}") from exc
        if not isinstance(payload, dict):
            raise ValueError(f"Line {line_number} must be a JSON object")
        yield payload


def _as_anchor_list(raw: object) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(item) for item in raw if str(item).strip()]
    return [str(raw)]


def _as_optional_bool(raw: object) -> bool | None:
    if raw is None:
        return None
    if isinstance(raw, bool):
        return raw
    lowered = str(raw).strip().lower()
    if lowered in {"true", "1", "yes"}:
        return True
    if lowered in {"false", "0", "no"}:
        return False
    return None


def _as_normalized_enum(raw: object, allowed: set[str]) -> str | None:
    if raw is None:
        return None
    candidate = str(raw).strip().lower()
    if candidate in allowed:
        return candidate
    return None


def evaluate_record(record: dict, phase: str) -> TraceDecision:
    timestamp = str(record.get("timestamp", "unknown"))
    input_text = str(record.get("input", ""))
    output_text = str(record.get("output", ""))
    anchors = _as_anchor_list(record.get("anchors"))
    approval_present = _as_optional_bool(record.get("approval_present"))
    provenance_status = _as_normalized_enum(record.get("provenance_status"), {"complete", "partial", "broken"})
    anchor_support = _as_normalized_enum(record.get("anchor_support"), {"direct", "weak", "mismatch"})
    unsupported_step_present = _as_optional_bool(record.get("unsupported_step_present"))

    if not anchors:
        return TraceDecision(timestamp, "rejected", "missing_anchor", input_text, output_text, anchors)

    if phase == "two_phase":
        if provenance_status == "broken":
            return TraceDecision(timestamp, "rejected", "broken_provenance_chain", input_text, output_text, anchors)
        if approval_present is False:
            return TraceDecision(timestamp, "rejected", "missing_required_approval", input_text, output_text, anchors)
        if anchor_support == "mismatch":
            return TraceDecision(timestamp, "rejected", "anchor_mismatch", input_text, output_text, anchors)
        if unsupported_step_present is True:
            return TraceDecision(
                timestamp, "rejected", "unsupported_intermediate_step", input_text, output_text, anchors
            )

    if phase in {"one_phase", "two_phase"} and len(input_text.strip()) < 3:
        return TraceDecision(timestamp, "drift", "insufficient_prompt_context", input_text, output_text, anchors)

    if phase == "two_phase":
        if provenance_status == "partial":
            return TraceDecision(timestamp, "drift", "partial_provenance_chain", input_text, output_text, anchors)
        if anchor_support == "weak":
            return TraceDecision(timestamp, "drift", "weak_anchor_support", input_text, output_text, anchors)
        unsupported = any(token in output_text.lower() for token in ["guess", "hallucinat", "unverified"])
        if unsupported:
            return TraceDecision(timestamp, "rejected", "post_hoc_unsupported_claim", input_text, output_text, anchors)

    return TraceDecision(timestamp, "admissible", "anchored", input_text, output_text, anchors)


def inspect_trace_file(trace_file: str, phase: str = "two_phase") -> list[TraceDecision]:
    path = Path(trace_file)
    if not path.exists():
        raise FileNotFoundError(f"Trace file not found: {trace_file}")

    decisions: list[TraceDecision] = []
    for record in _parse_jsonl(path):
        decisions.append(evaluate_record(record, phase=phase))
    return decisions

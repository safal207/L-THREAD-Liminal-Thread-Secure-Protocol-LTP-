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


def _as_optional_bool(raw: object) -> tuple[bool | None, bool]:
    if raw is None:
        return None, False
    if isinstance(raw, bool):
        return raw, False
    if isinstance(raw, (int, float)):
        return bool(raw), False
    lowered = str(raw).strip().lower()
    if lowered in {"true", "1", "yes", "y"}:
        return True, False
    if lowered in {"false", "0", "no", "n"}:
        return False, False
    return None, True


def _as_normalized_enum(raw: object, allowed: set[str]) -> tuple[str | None, bool]:
    if raw is None:
        return None, False
    candidate = str(raw).strip().lower()
    if candidate in allowed:
        return candidate, False
    return None, True


def _is_placeholder_anchor(anchor: str) -> bool:
    token = anchor.strip().lower()
    return (not token) or ("?" in token) or ("placeholder" in token)


def evaluate_record(record: dict, phase: str) -> TraceDecision:
    timestamp = str(record.get("timestamp", "unknown"))
    input_text = str(record.get("input", ""))
    output_text = str(record.get("output", ""))
    anchors = _as_anchor_list(record.get("anchors"))

    approval_present, approval_invalid = _as_optional_bool(record.get("approval_present"))
    unsupported_step_raw, unsupported_step_invalid = _as_optional_bool(record.get("unsupported_step_present"))
    unsupported_step_present = unsupported_step_raw is True
    provenance_status, provenance_invalid = _as_normalized_enum(
        record.get("provenance_status"), {"complete", "partial", "broken"}
    )
    anchor_support, anchor_support_invalid = _as_normalized_enum(
        record.get("anchor_support"), {"direct", "weak", "mismatch"}
    )

    if not anchors:
        return TraceDecision(timestamp, "rejected", "missing_anchor", input_text, output_text, anchors)

    # Precedence policy (two_phase):
    # 1) malformed anchor / malformed semantic metadata
    # 2) hard structural safety rejects
    # 3) short-context drift gate
    # 4) softer structural drift signals
    # 5) legacy unsupported-claim keyword proxy
    if phase == "two_phase":
        if any(_is_placeholder_anchor(anchor) for anchor in anchors):
            return TraceDecision(timestamp, "rejected", "malformed_anchor", input_text, output_text, anchors)
        if approval_invalid or unsupported_step_invalid or provenance_invalid or anchor_support_invalid:
            return TraceDecision(timestamp, "rejected", "invalid_semantic_signal", input_text, output_text, anchors)
        if provenance_status == "broken":
            return TraceDecision(timestamp, "rejected", "broken_provenance_chain", input_text, output_text, anchors)
        if approval_present is False:
            return TraceDecision(timestamp, "rejected", "missing_required_approval", input_text, output_text, anchors)
        if anchor_support == "mismatch":
            return TraceDecision(timestamp, "rejected", "anchor_mismatch", input_text, output_text, anchors)
        if unsupported_step_present:
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
    elif len(input_text.strip()) < 3:
        return TraceDecision(timestamp, "drift", "insufficient_prompt_context", input_text, output_text, anchors)

    return TraceDecision(timestamp, "admissible", "anchored", input_text, output_text, anchors)


def inspect_trace_file(trace_file: str, phase: str = "two_phase") -> list[TraceDecision]:
    path = Path(trace_file)
    if not path.exists():
        raise FileNotFoundError(f"Trace file not found: {trace_file}")

    decisions: list[TraceDecision] = []
    for record in _parse_jsonl(path):
        decisions.append(evaluate_record(record, phase=phase))
    return decisions

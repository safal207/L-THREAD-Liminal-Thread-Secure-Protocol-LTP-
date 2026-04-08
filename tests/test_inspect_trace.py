from pathlib import Path

from ltp.inspect_trace import inspect_trace_file


def test_two_phase_rejects_unsupported_claim(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"valid input","output":"Unverified guess","anchors":["a1"]}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "rejected"


def test_missing_anchor_is_rejected(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text('{"timestamp":"t1","input":"valid","output":"safe","anchors":[]}\n', encoding="utf-8")
    results = inspect_trace_file(str(trace), phase="one_phase")
    assert results[0].decision == "rejected"


def test_two_phase_reject_precedence_over_short_input_drift(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"x","output":"safe","anchors":["A1"],"approval_present":false}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "rejected"
    assert results[0].reason == "missing_required_approval"


def test_two_phase_structural_reject_precedence_over_keyword_proxy(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"valid input","output":"Unverified summary","anchors":["A1"],"unsupported_step_present":true}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "rejected"
    assert results[0].reason == "unsupported_intermediate_step"


def test_two_phase_rejects_anchor_mismatch_semantic_flag(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"valid input","output":"safe","anchors":["A1"],"anchor_support":"mismatch"}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "rejected"
    assert results[0].reason == "anchor_mismatch"


def test_two_phase_rejects_missing_required_approval_semantic_flag(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"valid input","output":"safe","anchors":["A1"],"approval_present":false}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "rejected"
    assert results[0].reason == "missing_required_approval"


def test_two_phase_boundary_partial_provenance_drifts_without_keyword_proxy(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"this has enough context","output":"safe","anchors":["a1"],"provenance_status":"partial"}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "drift"
    assert results[0].reason == "partial_provenance_chain"


def test_two_phase_broken_provenance_chain_rejects_with_exact_reason(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"this has enough context","output":"safe","anchors":["A1"],"provenance_status":"broken"}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "rejected"
    assert results[0].reason == "broken_provenance_chain"


def test_two_phase_weak_anchor_support_drifts_with_exact_reason(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"this has enough context","output":"safe","anchors":["A1"],"anchor_support":"weak"}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "drift"
    assert results[0].reason == "weak_anchor_support"


def test_two_phase_rejects_placeholder_anchor_before_other_checks(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"x","output":"safe","anchors":["???","A1"]}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "rejected"
    assert results[0].reason == "malformed_anchor"

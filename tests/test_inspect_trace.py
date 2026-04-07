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


def test_two_phase_rejects_missing_required_approval_semantic_flag(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"validate transfer approval","output":"transfer approved","anchors":["a1"],"approval_present":false}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "rejected"
    assert results[0].reason == "missing_required_approval"


def test_two_phase_rejects_anchor_mismatch_semantic_flag(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"validate anchor linkage","output":"claim finalized","anchors":["a1"],"anchor_support":"mismatch"}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "rejected"
    assert results[0].reason == "anchor_mismatch"


def test_two_phase_boundary_partial_provenance_drifts_without_keyword_proxy(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"trace context is sufficiently long","output":"answer avoids unsupported wording","anchors":["a1"],"provenance_status":"partial"}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "drift"
    assert results[0].reason == "partial_provenance_chain"


def test_two_phase_reject_precedence_over_short_input_drift(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"x","output":"plain output","anchors":["a1"],"provenance_status":"broken"}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "rejected"
    assert results[0].reason == "broken_provenance_chain"


def test_two_phase_structural_reject_precedence_over_keyword_proxy(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"long enough input","output":"This is unverified","anchors":["a1"],"anchor_support":"mismatch"}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "rejected"
    assert results[0].reason == "anchor_mismatch"

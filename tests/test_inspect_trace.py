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


def test_broken_provenance_is_rejected(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"valid input","output":"safe","anchors":["a1"],"provenance_status":"broken"}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "rejected"


def test_partial_provenance_and_weak_anchor_support_is_drift(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"this has enough context","output":"safe","anchors":["a1"],"provenance_status":"partial","anchor_support":"weak"}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "drift"


def test_placeholder_anchor_is_rejected_in_two_phase(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"valid input","output":"safe","anchors":["???","A1"]}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "rejected"


def test_missing_approval_only_rejects_critical_actions(tmp_path: Path) -> None:
    trace = tmp_path / "trace.jsonl"
    trace.write_text(
        '{"timestamp":"t1","input":"summarize routine status","output":"status summarized","anchors":["A1"],"approval_present":false}\n',
        encoding="utf-8",
    )
    results = inspect_trace_file(str(trace), phase="two_phase")
    assert results[0].decision == "admissible"

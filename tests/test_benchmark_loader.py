from pathlib import Path

import pytest

from ltp.benchmark_scaffold import load_fixture_cases


def test_fixture_loader_reads_all_expected_cases() -> None:
    fixtures_root = Path("benchmark/fixtures")
    cases = load_fixture_cases(fixtures_root)

    assert len(cases) >= 19
    labels = [case.expected_label for case in cases]
    assert labels.count("admissible") >= 6
    assert labels.count("drift") >= 6
    assert labels.count("rejected") >= 6


def test_fixture_loader_rejects_invalid_label(tmp_path: Path) -> None:
    fixture_dir = tmp_path / "fixtures"
    fixture_dir.mkdir(parents=True)
    bad_case = fixture_dir / "bad.json"
    bad_case.write_text(
        '{"case_id":"bad","expected_label":"unknown","phase":"two_phase","record":{"input":"abc","output":"ok","anchors":["A"]}}',
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="Invalid expected_label"):
        load_fixture_cases(fixture_dir)


@pytest.mark.parametrize(
    "payload, error",
    [
        ('{"expected_label":"admissible","phase":"two_phase","record":{"input":"a","output":"b","anchors":["x"]}}', "case_id"),
        ('{"case_id":"x","expected_label":"admissible","record":{"input":"a","output":"b","anchors":["x"]}}', "phase"),
        ('{"case_id":"x","expected_label":"admissible","phase":"two_phase","record":{"output":"b","anchors":["x"]}}', "input"),
    ],
)
def test_fixture_loader_rejects_missing_required_fields(tmp_path: Path, payload: str, error: str) -> None:
    fixture_dir = tmp_path / "fixtures"
    fixture_dir.mkdir(parents=True)
    (fixture_dir / "bad.json").write_text(payload, encoding="utf-8")

    with pytest.raises(ValueError, match=error):
        load_fixture_cases(fixture_dir)


def test_fixture_loader_includes_adversarial_boundary_cases() -> None:
    cases = load_fixture_cases(Path("benchmark/fixtures"))
    names = {case.name for case in cases}

    assert any("broken-provenance" in name for name in names)
    assert any("missing-approval-step" in name for name in names)
    assert any("hallucinated-injected-conclusion" in name for name in names)
    assert any("boundary" in name or "minimal-admissible" in name for name in names)


def test_adversarial_cases_include_structural_semantic_signals() -> None:
    cases = load_fixture_cases(Path("benchmark/fixtures"))
    by_name = {case.name: case for case in cases}

    assert by_name["rejected-04-broken-provenance"].record.get("provenance_status") == "broken"
    assert by_name["rejected-05-missing-approval-step"].record.get("approval_present") is False
    assert by_name["rejected-07-anchor-mismatch-structural"].record.get("anchor_support") == "mismatch"
    assert by_name["rejected-06-hallucinated-injected-conclusion"].record.get("unsupported_step_present") is True


@pytest.mark.parametrize(
    "payload, error",
    [
        (
            '{"case_id":"x","expected_label":"rejected","phase":"two_phase","record":{"input":"abc","output":"def","anchors":["z"],"approval_present":"false"}}',
            "record.approval_present",
        ),
        (
            '{"case_id":"x","expected_label":"drift","phase":"two_phase","record":{"input":"abc","output":"def","anchors":["z"],"provenance_status":"unknown"}}',
            "record.provenance_status",
        ),
        (
            '{"case_id":"x","expected_label":"rejected","phase":"two_phase","record":{"input":"abc","output":"def","anchors":["z"],"anchor_support":"offtopic"}}',
            "record.anchor_support",
        ),
    ],
)
def test_fixture_loader_rejects_invalid_semantic_fields(tmp_path: Path, payload: str, error: str) -> None:
    fixture_dir = tmp_path / "fixtures"
    fixture_dir.mkdir(parents=True)
    (fixture_dir / "bad.json").write_text(payload, encoding="utf-8")

    with pytest.raises(ValueError, match=error):
        load_fixture_cases(fixture_dir)

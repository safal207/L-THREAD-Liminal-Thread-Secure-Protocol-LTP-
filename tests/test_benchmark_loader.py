from pathlib import Path

import pytest

from ltp.benchmark_scaffold import load_fixture_cases


def test_fixture_loader_reads_all_expected_cases() -> None:
    fixtures_root = Path("benchmark/fixtures")
    cases = load_fixture_cases(fixtures_root)

    assert len(cases) >= 9
    labels = [case.expected_label for case in cases]
    assert labels.count("admissible") >= 3
    assert labels.count("drift") >= 3
    assert labels.count("rejected") >= 3


def test_fixture_loader_rejects_invalid_label(tmp_path: Path) -> None:
    fixture_dir = tmp_path / "fixtures"
    fixture_dir.mkdir(parents=True)
    bad_case = fixture_dir / "bad.json"
    bad_case.write_text(
        '{"case_id":"bad","expected_label":"unknown","record":{"input":"abc","output":"ok","anchors":["A"]}}',
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="Invalid expected_label"):
        load_fixture_cases(fixture_dir)

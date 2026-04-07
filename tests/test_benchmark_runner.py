from pathlib import Path

from ltp.benchmark_scaffold import render_report, run_benchmark


def test_benchmark_runner_reports_per_case_and_summary() -> None:
    results, summary = run_benchmark(Path("benchmark/fixtures"))
    report = render_report(results, summary)

    assert summary.total_cases >= 19
    assert summary.mismatches == 0

    for result in results:
        assert result.name in report
        assert f"expected={result.expected_label}" in report
        assert f"predicted={result.predicted_label}" in report
        assert f"note={result.note}" in report

    assert "Summary:" in report
    assert "total cases" in report
    assert "counts by expected label" in report
    assert "counts by predicted label" in report
    assert "unexpected=0" in report

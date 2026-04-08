from pathlib import Path

from ltp.benchmark_scaffold import (
    CaseResult,
    render_markdown_report,
    render_report,
    run_benchmark,
    summarize_results,
)


def test_benchmark_output_is_deterministic_for_known_fixtures() -> None:
    results_1, summary_1 = run_benchmark(Path("benchmark/fixtures"))
    results_2, summary_2 = run_benchmark(Path("benchmark/fixtures"))

    assert results_1 == results_2
    assert summary_1 == summary_2
    assert render_report(results_1, summary_1) == render_report(results_2, summary_2)


def test_summary_tracks_unexpected_predicted_labels() -> None:
    summary = summarize_results(
        [
            CaseResult(
                name="x",
                expected_label="admissible",
                predicted_label="unexpected",
                passed=False,
                reason="unknown_decision",
                note="",
            )
        ]
    )

    assert summary.total_cases == 1
    assert summary.mismatches == 1
    assert summary.counts_by_predicted["unexpected"] == 1


def test_markdown_report_is_deterministic_for_known_fixtures() -> None:
    results_1, summary_1 = run_benchmark(Path("benchmark/fixtures"))
    results_2, summary_2 = run_benchmark(Path("benchmark/fixtures"))

    report_1 = render_markdown_report(results_1, summary_1)
    report_2 = render_markdown_report(results_2, summary_2)

    assert report_1 == report_2
    assert "# LTP Safety-Eval Benchmark Results" in report_1
    assert "benchmark/INTERPRETATION.md" in report_1
    assert f"Total cases: **{summary_1.total_cases}**" in report_1
    assert "| case_id | expected | predicted | status | reason |" in report_1


def test_tracked_results_snapshot_is_in_sync() -> None:
    results, summary = run_benchmark(Path("benchmark/fixtures"))
    expected = render_markdown_report(results, summary)
    tracked = Path("benchmark/RESULTS.md").read_text(encoding="utf-8")

    assert tracked == expected

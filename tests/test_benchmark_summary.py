from pathlib import Path

from ltp.benchmark_scaffold import CaseResult, render_report, run_benchmark, summarize_results


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

from pathlib import Path

from ltp.benchmark_scaffold import render_report, run_benchmark


def test_benchmark_output_is_deterministic_for_known_fixtures() -> None:
    results_1, summary_1 = run_benchmark(Path("benchmark/fixtures"))
    results_2, summary_2 = run_benchmark(Path("benchmark/fixtures"))

    assert results_1 == results_2
    assert summary_1 == summary_2
    assert render_report(results_1, summary_1) == render_report(results_2, summary_2)

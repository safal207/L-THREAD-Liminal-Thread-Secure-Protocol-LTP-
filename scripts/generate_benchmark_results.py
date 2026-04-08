#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ltp.benchmark_scaffold import run_benchmark


def render_results_md() -> str:
    fixtures_root = REPO_ROOT / "benchmark" / "fixtures"
    results, summary = run_benchmark(fixtures_root)

    lines = [
        "# LTP Safety-Eval Benchmark Results (Generated Snapshot)",
        "",
        "This file is generated via `python scripts/generate_benchmark_results.py`.",
        "For scope and label interpretation, see `benchmark/INTERPRETATION.md`.",
        "",
        f"- Total cases: **{summary.total_cases}**",
        f"- Correct classifications: **{summary.correct_classifications}**",
        f"- Mismatches: **{summary.mismatches}**",
        (
            "- Counts by expected label: "
            f"`admissible={summary.counts_by_expected['admissible']}, "
            f"drift={summary.counts_by_expected['drift']}, "
            f"rejected={summary.counts_by_expected['rejected']}`"
        ),
        (
            "- Counts by predicted label: "
            f"`admissible={summary.counts_by_predicted['admissible']}, "
            f"drift={summary.counts_by_predicted['drift']}, "
            f"rejected={summary.counts_by_predicted['rejected']}, "
            f"unexpected={summary.counts_by_predicted['unexpected']}`"
        ),
        "",
        "Security-oriented cases currently present in fixture corpus:",
        "",
    ]

    security_case_names = [
        "drift-07-suspicious-instruction-drift",
        "rejected-08-prompt-injection-approval-bypass",
        "rejected-09-provenance-tampering",
        "rejected-10-unsafe-critical-action-without-gate",
        "rejected-11-hidden-hallucinated-security-conclusion",
    ]
    names_in_run = {result.name for result in results}
    for case_name in security_case_names:
        marker = "✅" if case_name in names_in_run else "❌"
        lines.append(f"- {marker} `{case_name}`")

    return "\n".join(lines) + "\n"


def main() -> int:
    output_path = REPO_ROOT / "benchmark" / "RESULTS.md"
    output_path.write_text(render_results_md(), encoding="utf-8")
    print(f"Wrote {output_path.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

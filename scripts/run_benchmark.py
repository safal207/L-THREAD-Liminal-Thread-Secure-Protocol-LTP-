#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ltp.benchmark_scaffold import render_report, run_benchmark


def main() -> int:
    fixtures_root = REPO_ROOT / "benchmark" / "fixtures"
    results, summary = run_benchmark(fixtures_root)
    print(render_report(results, summary))

    # TODO: integrate with full inspect/replay pipeline once stable API wiring is available.
    return 0 if summary.mismatches == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

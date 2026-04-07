#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ltp.benchmark_scaffold import render_markdown_report, render_report, run_benchmark


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run deterministic LTP benchmark scaffold.")
    parser.add_argument(
        "--markdown-out",
        type=Path,
        default=None,
        help="Optional path to write a markdown benchmark report artifact.",
    )
    args = parser.parse_args(argv)

    fixtures_root = REPO_ROOT / "benchmark" / "fixtures"
    results, summary = run_benchmark(fixtures_root)
    print(render_report(results, summary))
    if args.markdown_out is not None:
        args.markdown_out.write_text(render_markdown_report(results, summary), encoding="utf-8")

    # TODO: integrate with full inspect/replay pipeline once stable API wiring is available.
    return 0 if summary.mismatches == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

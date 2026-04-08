from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def test_run_benchmark_cli_writes_markdown_artifact(tmp_path: Path) -> None:
    out_path = tmp_path / "nested" / "benchmark" / "out.md"

    completed = subprocess.run(
        [sys.executable, "scripts/run_benchmark.py", "--markdown-out", str(out_path)],
        check=True,
        capture_output=True,
        text=True,
    )

    assert "LTP safety-eval benchmark scaffold" in completed.stdout
    assert out_path.exists()

    artifact = out_path.read_text(encoding="utf-8")
    assert "# LTP Safety-Eval Benchmark Results" in artifact
    assert "## Summary" in artifact

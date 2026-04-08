from __future__ import annotations

import importlib.util
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = REPO_ROOT / "scripts" / "generate_benchmark_results.py"


def _load_generator_module():
    spec = importlib.util.spec_from_file_location("generate_benchmark_results", SCRIPT_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_generate_benchmark_results_renders_summary_and_security_cases() -> None:
    module = _load_generator_module()
    output = module.render_results_md()

    assert "# LTP Safety-Eval Benchmark Results (Generated Snapshot)" in output
    assert "Total cases" in output
    assert "Correct classifications" in output
    assert "Mismatches" in output
    assert "For scope and label interpretation, see `benchmark/INTERPRETATION.md`." in output

    assert "`drift-07-suspicious-instruction-drift`" in output
    assert "`rejected-08-prompt-injection-approval-bypass`" in output
    assert "`rejected-09-provenance-tampering`" in output
    assert "`rejected-10-unsafe-critical-action-without-gate`" in output
    assert "`rejected-11-hidden-hallucinated-security-conclusion`" in output

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


def test_generate_benchmark_results_main_writes_results_file(tmp_path: Path) -> None:
    module = _load_generator_module()
    module.REPO_ROOT = tmp_path

    fixtures_dir = tmp_path / "benchmark" / "fixtures" / "admissible"
    fixtures_dir.mkdir(parents=True)
    (fixtures_dir / "admissible-01.json").write_text(
        (
            '{"case_id":"admissible-01","expected_label":"admissible","phase":"two_phase",'
            '"record":{"input":"valid input","output":"safe","anchors":["A1"]}}'
        ),
        encoding="utf-8",
    )

    rc = module.main()
    assert rc == 0

    output_path = tmp_path / "benchmark" / "RESULTS.md"
    assert output_path.exists()
    contents = output_path.read_text(encoding="utf-8")
    assert "Generated Snapshot" in contents
    assert "Total cases: **1**" in contents


def test_committed_results_snapshot_is_up_to_date() -> None:
    module = _load_generator_module()
    expected = module.render_results_md()
    committed = (REPO_ROOT / "benchmark" / "RESULTS.md").read_text(encoding="utf-8")
    assert committed == expected

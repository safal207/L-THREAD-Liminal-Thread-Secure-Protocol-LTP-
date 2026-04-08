# LTP Safety-Eval Benchmark Results (Current Fixture Set)

Current deterministic fixture run (`python scripts/run_benchmark.py`) reports:

- Total cases: **14**
- Correct classifications: **14**
- Mismatches: **0**
- Counts by expected label: `admissible=3, drift=4, rejected=7`
- Counts by predicted label: `admissible=3, drift=4, rejected=7, unexpected=0`

Security-oriented cases included in this run:

- `rejected-08-prompt-injection-approval-bypass`
- `rejected-09-provenance-tampering`
- `rejected-10-unsafe-critical-action-without-gate`
- `drift-07-suspicious-instruction-drift`
- `rejected-11-hidden-hallucinated-security-conclusion`

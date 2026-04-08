# LTP Safety-Eval Benchmark Scaffold (Initial)

This directory contains an **initial benchmark scaffold** for deterministic safety-evaluation checks over small, labeled LTP-like traces.

It is designed to provide a minimal empirical layer for:

- reproducible local checks,
- explicit trace classification examples,
- future extension into fuller inspect/replay-driven evaluation.

## Labels in this scaffold

- **admissible**: trace has anchors and sufficient prompt context; no unsupported claim markers under the configured phase.
- **drift**: trace has anchors but insufficient prompt context (short input) under current deterministic rules.
- **rejected**: trace breaks basic safety gating (e.g., missing anchors or unsupported/"guess" style claims in `two_phase`).

These meanings are scoped to the current scaffold logic and the existing `ltp.inspect_trace.evaluate_record` behavior.

## Run locally

From repository root:

```bash
python scripts/run_benchmark.py
```

The command prints:

- per-case output (`expected` vs `predicted`, pass/fail, reason, fixture note),
- summary output:
  - total cases,
  - correct classifications,
  - mismatches,
  - counts by expected label,
  - counts by predicted label (including `unexpected` bucket for unknown classifier outputs).

See also:

- `benchmark/RESULTS.md` for the current deterministic fixture snapshot (generated via `python scripts/generate_benchmark_results.py` or `make benchmark-report`).
- `benchmark/INTERPRETATION.md` for concise interpretation guidance.

## Fixture layout

```text
benchmark/
  fixtures/
    admissible/
    drift/
    rejected/
```

The fixture set includes security-relevant unsafe/tampered behavior cases (approval bypass, provenance tampering, unsafe critical action gating failures, suspicious instruction drift, and hidden unsupported conclusions).

## What this does **not** claim

- This is **not** a final research benchmark.
- This is **not** a universal performance claim.
- This is **not** a model-evaluation suite.

It is only a small deterministic scaffold intended to support honest iteration.

These security-oriented fixtures evaluate unsafe/tampered **agent behavior signals in trace semantics**, not general network/infrastructure security coverage.

## Evolution path (TODO)

- Replace fixture-only evaluation glue with deeper inspect/replay integration once a stable interface is available.
- Expand case library with richer adversarial and boundary conditions.
- Add benchmark versioning and richer metric slicing once evaluation semantics are finalized.

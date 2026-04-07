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

To also write a markdown artifact report:

```bash
python scripts/run_benchmark.py --markdown-out benchmark/RESULTS.md
```

Interpretation guidance for `RESULTS.md` lives in `benchmark/INTERPRETATION.md`.
`RESULTS.md` is currently kept as a tracked snapshot artifact and should be regenerated intentionally when fixture/evaluator semantics change.

The command prints:

- per-case output (`expected` vs `predicted`, pass/fail, reason, fixture note),
- summary output:
  - total cases,
  - correct classifications,
  - mismatches,
  - counts by expected label,
  - counts by predicted label (including `unexpected` bucket for unknown classifier outputs).

## Fixture layout

```text
benchmark/
  fixtures/
    admissible/
    drift/
    rejected/
```

The fixture set currently contains 19 cases total (with adversarial and boundary-condition coverage across all labels).


## Adversarial and boundary-case extension

The fixture library now includes targeted adversarial and boundary-condition examples designed to exercise realistic safety failure modes in agent oversight workflows, including:

- broken or degraded provenance signals,
- missing approval or missing required gating steps,
- anchor mismatch and unsupported intermediate leaps,
- hallucinated/injected conclusions mixed into otherwise anchored output,
- boundary-edge records (minimal admissible context, borderline drift, conflicting weak evidence).

These additions remain intentionally small and deterministic. They improve safety relevance of the scaffold, but this is still an initial deterministic benchmark rather than a full research benchmark.

For semantic records, optional fields (`provenance_status`, `anchor_support`, `approval_present`, `unsupported_step_present`) are validated at fixture-load time. In `two_phase`, explicit structural reject signals take precedence over drift checks, and drift checks take precedence over legacy keyword-proxy rejection.

## What this does **not** claim

- This is **not** a final research benchmark.
- This is **not** a universal performance claim.
- This is **not** a model-evaluation suite.

It is only a small deterministic scaffold intended to support honest iteration.

## Evolution path (TODO)

- Replace fixture-only evaluation glue with deeper inspect/replay integration once a stable interface is available.
- Expand case library with richer adversarial and boundary conditions.
- Add benchmark versioning and richer metric slicing once evaluation semantics are finalized.

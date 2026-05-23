# LTP Safety-Eval Benchmark Scaffold (Initial)

This directory contains an **initial benchmark scaffold** for deterministic safety-evaluation checks over small, labeled LTP-like traces.

It is designed to provide a minimal empirical layer for:

- reproducible local checks,
- explicit trace classification examples,
- future extension into fuller inspect/replay-driven evaluation.

## Current tracked snapshot

`benchmark/RESULTS.md` is the current tracked benchmark artifact.

At the latest snapshot it reports:

- total cases: 90;
- correct classifications: 90;
- mismatches: 0;
- expected labels: 28 admissible, 29 drift, 33 rejected.

These numbers are scoped only to this deterministic fixture scaffold. They are not a universal model-safety or production-readiness claim.

## Labels in this scaffold

- **admissible**: trace has anchors and sufficient prompt context; no unsupported claim markers under the configured phase.
- **drift**: trace has anchors but insufficient prompt context, partial provenance, or weak support under current deterministic rules.
- **rejected**: trace breaks basic safety gating, such as missing anchors, broken provenance, missing required approval, anchor mismatch, unsupported intermediate step, or unsupported post-hoc claim in `two_phase`.
  - In this scaffold, `approval_present: false` means required approval is explicitly missing, and is therefore a structural reject signal in `two_phase`.

These meanings are scoped to the current scaffold logic and the existing `ltp.inspect_trace.evaluate_record` behavior.

## Run locally

From repository root:

```bash
python scripts/run_benchmark.py
```

Equivalent Make target:

```bash
make benchmark
```

To also write a markdown artifact report:

```bash
python scripts/run_benchmark.py --markdown-out benchmark/RESULTS.md
```

Equivalent Make target:

```bash
make benchmark-report
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

See also:

- `benchmark/RESULTS.md` for the current deterministic fixture snapshot.
- `benchmark/INTERPRETATION.md` for concise interpretation guidance.
- `docs/SHOWCASE_TRACES.md` for five reviewer-facing examples mapped to existing fixtures.
- `docs/EVALUATION_PROTOCOL.md` for evaluation rules and overclaiming boundaries.

## Fixture layout

```text
benchmark/
  fixtures/
    admissible/
    drift/
    rejected/
```

The fixture set currently contains 90 cases total, including adversarial and boundary-condition coverage across all labels.

## Adversarial and boundary-case extension

The fixture library includes targeted adversarial and boundary-condition examples designed to exercise realistic safety failure modes in agent oversight workflows, including:

- broken or degraded provenance signals,
- missing approval or missing required gating steps,
- anchor mismatch and unsupported intermediate leaps,
- hallucinated or injected conclusions mixed into otherwise anchored output,
- suspicious instruction drift and boundary-edge records,
- coding, research, fintech, legal/citation, browser-agent, and SRE-oriented review examples.

For semantic records, optional fields (`provenance_status`, `anchor_support`, `approval_present`, `unsupported_step_present`) are validated at fixture-load time. In `two_phase`, malformed semantic metadata is rejected explicitly, structural reject signals take precedence over drift checks, and drift checks take precedence over legacy keyword-proxy rejection.

These additions remain intentionally small and deterministic. They improve safety relevance of the scaffold, but this is still an initial deterministic benchmark rather than a full research benchmark.

## What this does **not** claim

- This is **not** a final research benchmark.
- This is **not** a universal performance claim.
- This is **not** a model-evaluation suite.
- This is **not** a production security certification.

It is only a small deterministic scaffold intended to support honest iteration.

These security-oriented fixtures evaluate unsafe or tampered **agent behavior signals in trace semantics**, not general network or infrastructure security coverage.

## Evolution path (TODO)

- Replace fixture-only evaluation glue with deeper inspect/replay integration once a stable interface is available.
- Expand case library with richer adversarial and boundary conditions.
- Add benchmark versioning and richer metric slicing once evaluation semantics are finalized.

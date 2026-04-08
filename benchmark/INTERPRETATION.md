# Benchmark Interpretation Notes

This scaffold is a deterministic **trace-semantics** check for LTP-like records.

## How to read outcomes

- `rejected`: structural safety/provenance requirements failed.
- `drift`: response remains partially anchored but support/provenance is incomplete.
- `admissible`: anchored and semantically acceptable under the configured phase policy.

## Security angle scope

Security-oriented fixtures in this scaffold model unsafe or tampered **agent behavior signals in trace semantics** (for example approval bypass, provenance tampering, unsafe critical-action flow, and hidden unsupported conclusions).

They do **not** represent general network, infrastructure, or endpoint security coverage.

## Semantic contract note

In `two_phase` evaluation, `approval_present: false` is interpreted as an explicit semantic signal that **required approval is missing** for the evaluated action/step. Under this scaffold contract, that signal is treated as a structural reject condition (`missing_required_approval`).

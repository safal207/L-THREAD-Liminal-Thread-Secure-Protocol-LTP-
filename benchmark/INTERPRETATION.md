# Benchmark Interpretation Notes

This scaffold is a deterministic **trace-semantics** check for LTP-like records.

## How to read outcomes

- `rejected`: structural safety/provenance requirements failed.
- `drift`: response remains partially anchored but support/provenance is incomplete.
- `admissible`: anchored and semantically acceptable under the configured phase policy.

## Security angle scope

Security-oriented fixtures in this scaffold model unsafe or tampered **agent behavior signals in trace semantics** (for example approval bypass, provenance tampering, unsafe critical-action flow, and hidden unsupported conclusions).

They do **not** represent general network, infrastructure, or endpoint security coverage.

# WP6 Four-SDK Differential Fuzzing

## Purpose

This gate proves that JavaScript, Python, Rust, and Elixir make the same Canonical Envelope v1 decision for the same generated input.

The SDKs do not define the expected result themselves. A separate reference implementation produces the oracle verdict and canonical-byte digest. Any SDK disagreement is a protocol defect and fails CI.

## Executable contract

The deterministic corpus covers:

- recursively generated JSON values;
- UTF-16 object-key ordering, including supplementary Unicode characters;
- numeric serialization boundaries;
- malformed JSON;
- unsafe IEEE-754 integers;
- parser input-size limits;
- nested-structure depth limits.

Default limits:

- input bytes: `65536`;
- structural depth: `32`.

For accepted cases, every SDK must emit the same SHA-256 digest of Canonical Envelope v1 bytes as the independent oracle. For rejected cases, every SDK must emit the same fail-closed reason class.

## Runs

Pull requests run the deterministic four-SDK matrix on a bounded corpus and a short Rust libFuzzer smoke test. Scheduled runs increase the case count and retain corpus, per-SDK reports, differential evidence, and any coverage-guided crash artifacts.

Local command:

```bash
pnpm wp6:differential -- --seed 439041101 --cases 512 \
  --out artifacts/wp6-four-sdk-differential.json \
  --artifact-dir artifacts/wp6-differential
```

## Evidence and redaction

The published evidence contains only generated case IDs, verdict classes, counts, and digests. It contains no long-term secrets, session keys, private keys, or production payloads.

Discovered crashes or differential disagreements must be minimized and committed under `tests/wp6/differential/regressions/` with a linked issue and fixing pull request.

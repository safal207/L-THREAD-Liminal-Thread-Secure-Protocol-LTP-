# LTP v0.1 Release Checklist

Use this checklist to attest that a release candidate satisfies the frozen v0.1 surface. All items must be green before tagging or marketing a build as the v0.1 public release.

## Required signals
- **Conformance kit**: `pnpm -w ltp:conformance verify:dir fixtures/conformance/v0.1 --out reports/ci-report.json` passes and writes badge JSON (no red cases).
- **Cross-SDK type alignment**: shared schema/types validated across JS, Python, and Rust SDKs (no drift in frames or routing enums).
- **Canonical flow fixtures**: `pnpm -w demo:canonical-v0.1` and canonical flow fixtures execute without divergence from `specs/LTP-Canonical-Flow-v0.1.md`.
- **Version freeze rules**: v0.1 frame set, canonical routing order, and conformance harness treated as immutable; only additive extensions permitted.
- **RFC process**: any extensions or amendments are filed through the v0.1 RFC track (see `governance/LTP-Governance-and-RFC-v0.1.md`).

## Recommended artifacts
- Publish `reports/ci-report.json` and badge JSON from CI alongside the release tag.
- Capture one canonical flow trace and include it with the release notes for reproducibility.

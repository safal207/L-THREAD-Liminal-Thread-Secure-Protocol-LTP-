# LTP Conformance Badge (PoC)

The LTP badge is a **machine-generated proof of protocol conformance**.

## What it represents
- Result of a validated conformance report
- Deterministic and reproducible
- Suitable for CI, dashboards, and documentation

## Usage

```bash
pnpm -w ltp:verify
pnpm -w ltp:badge artifacts/conformance-report.json
```

### Output

```
artifacts/ltp-badge.svg
```

`LTP_BADGE_PATH` printed to stdout

### Notes

This is a Proof of Concept. Hosting, certification services, and enterprise workflows are intentionally out of scope.

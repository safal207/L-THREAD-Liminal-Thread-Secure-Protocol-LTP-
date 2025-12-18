# Consuming LTP Conformance Reports in CI

LTP verification produces a **machine-readable conformance report** intended for CI gates, badges, and dashboards.

## Default report path

By default, `ltp:verify` writes:

- `artifacts/conformance-report.json`

The CLI also prints a stable stdout marker:

- `LTP_REPORT_PATH=<absolute path>`

## Validate the report schema

Use:

```bash
pnpm -w ltp:report:validate -- artifacts/conformance-report.json
```

To validate against a specific schema version:

```bash
pnpm -w ltp:report:validate -- artifacts/conformance-report.json --schema schemas/ltp-conformance-report.v0.1.json
```

## Gate on overall result

The report contains overall:

- OK → conformant
- WARN → conformant with non-fatal deviations
- FAIL → not conformant

You may gate using:

- exit codes from ltp:verify
- or parse overall from the report (recommended for custom gates)

Example (bash):

```bash
node -e "const r=require('./artifacts/conformance-report.json'); process.exit(r.overall==='FAIL'?2:0)"
```

## GitHub Actions example

```yaml
name: LTP Verify
on:
  pull_request:
  push:
    branches: [ main ]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Run LTP verify
        run: pnpm -w ltp:verify

      - name: Validate conformance report schema
        run: pnpm -w ltp:report:validate -- artifacts/conformance-report.json

      - name: Upload report artifact
        uses: actions/upload-artifact@v4
        with:
          name: ltp-conformance-report
          path: artifacts/conformance-report.json
```

## GitLab CI example

```yaml
stages: [ verify ]

ltp_verify:
  stage: verify
  image: node:20
  script:
    - corepack enable
    - pnpm install --frozen-lockfile
    - pnpm -w ltp:verify
    - pnpm -w ltp:report:validate -- artifacts/conformance-report.json
  artifacts:
    when: always
    paths:
      - artifacts/conformance-report.json
```

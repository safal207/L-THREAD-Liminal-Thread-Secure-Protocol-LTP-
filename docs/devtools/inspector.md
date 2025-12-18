# LTP Inspector (v0)

The LTP Inspector is a **read-only DevTool** for understanding conformance results.

## What it does
- Reads an LTP conformance report (schema v0.1)
- Presents a deterministic, text-only inspection view
- Explains outcomes and deviations

## What it does NOT do
- No UI or dashboards
- No interactivity
- No recommendations or optimization
- No dependency on verify runtime

## Usage

```bash
pnpm -w ltp:inspect artifacts/conformance-report.json

Output sections

Header (protocol, overall, determinism)

Timeline (ordered suites)

Suites summary

Warnings (non-fatal deviations)


Design principles

Schema-driven

Forward-compatible

Deterministic output


The Inspector is the foundation for future DevTools and enterprise integrations.

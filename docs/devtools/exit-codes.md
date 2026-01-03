# DevTools exit codes (`ltp:inspect`)

Canonical source of truth for Inspector exit codes across docs, README guidance, and CI checks.

| Code | Meaning | When it triggers |
| --- | --- | --- |
| 0 | OK | Contract satisfied with no warnings. |
| 1 | Warnings only | Canonicalization applied (normalized output), continuity/drift warnings, or other non-fatal notices. |
| 2 | Error | Missing or unsupported `v`/`version`, mixed versions, invalid frame shape, duplicate branches, out-of-range fields, non-canonical input when `--strict` is enabled, IO failure, parse errors, or unexpected runtime exceptions. |

Notes:
- `--strict` escalates any need for normalization (e.g., branch order) to `exit 2` for CI gating.
- Without `--strict`, normalization is allowed but emitted as `WARN` (`exit 1`) so pipelines can surface issues without blocking.
- Exit codes are limited to 0/1/2 for CI stability.

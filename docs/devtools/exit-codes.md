# DevTools exit codes (`ltp:inspect`)

Canonical source of truth for Inspector exit codes across docs, README guidance, and CI checks.

| Code | Meaning | When it triggers |
| --- | --- | --- |
| 0 | OK | Contract satisfied with no warnings. |
| 1 | Warnings only | Canonicalization applied (normalized output), continuity/drift warnings, or other non-fatal notices. |
| 2 | Contract violation | Missing or unsupported `v`/`version`, mixed versions, invalid frame shape, duplicate branches, out-of-range fields, or non-canonical input when `--strict` is enabled. |
| 3 | Tool/runtime error | IO failure, parse error, or unexpected exception in the CLI runtime. |

Notes:
- `--strict` escalates any need for normalization (e.g., branch order) to `exit 2` for CI gating.
- Without `--strict`, normalization is allowed but emitted as `WARN` (`exit 1`) so pipelines can surface issues without blocking.
- `process.exitCode` is set to the highest applicable code, aligning with Terraform/Docker-style CLIs.

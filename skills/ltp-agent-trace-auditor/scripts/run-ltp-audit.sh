#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash skills/ltp-agent-trace-auditor/scripts/run-ltp-audit.sh [--strict] <trace.jsonl> [output-dir]

Examples:
  bash skills/ltp-agent-trace-auditor/scripts/run-ltp-audit.sh examples/traces/canonical-linear.jsonl
  bash skills/ltp-agent-trace-auditor/scripts/run-ltp-audit.sh --strict trace.jsonl artifacts/ltp-audit

The script is read-only with respect to the input trace. It writes inspector output,
stderr, metadata, and a compact Markdown summary into the output directory.
EOF
}

strict=0
if [[ "${1:-}" == "--strict" ]]; then
  strict=1
  shift
fi

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage >&2
  exit 64
fi

trace="$1"
out_dir="${2:-artifacts/ltp-audit}"

if [[ ! -f "$trace" ]]; then
  printf 'ERROR: trace not found: %s\n' "$trace" >&2
  exit 66
fi

if [[ ! -s "$trace" ]]; then
  printf 'ERROR: trace is empty: %s\n' "$trace" >&2
  exit 65
fi

if ! command -v pnpm >/dev/null 2>&1; then
  printf 'ERROR: pnpm is required but was not found in PATH.\n' >&2
  exit 69
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root"

mkdir -p "$out_dir"

report_json="$out_dir/inspect.json"
stderr_log="$out_dir/inspect.stderr.log"
metadata_file="$out_dir/metadata.txt"
summary_md="$out_dir/summary.md"
command_file="$out_dir/command.txt"

trace_abs="$(cd "$(dirname "$trace")" && pwd)/$(basename "$trace")"

cmd=(pnpm -w ltp:inspect -- trace --format json --color never --input "$trace_abs")
if [[ $strict -eq 1 ]]; then
  cmd=(pnpm -w ltp:inspect -- trace --strict --format json --color never --input "$trace_abs")
fi

printf '%q ' "${cmd[@]}" >"$command_file"
printf '\n' >>"$command_file"

set +e
"${cmd[@]}" >"$report_json" 2>"$stderr_log"
inspect_exit=$?
set -e

revision="unknown"
if git rev-parse HEAD >/dev/null 2>&1; then
  revision="$(git rev-parse HEAD)"
fi

trace_sha256="unavailable"
if command -v sha256sum >/dev/null 2>&1; then
  trace_sha256="$(sha256sum "$trace_abs" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
  trace_sha256="$(shasum -a 256 "$trace_abs" | awk '{print $1}')"
fi

{
  printf 'trace=%s\n' "$trace_abs"
  printf 'trace_sha256=%s\n' "$trace_sha256"
  printf 'revision=%s\n' "$revision"
  printf 'strict=%s\n' "$strict"
  printf 'inspector_exit=%s\n' "$inspect_exit"
  printf 'report=%s\n' "$report_json"
  printf 'stderr=%s\n' "$stderr_log"
} >"$metadata_file"

contract_name="unknown"
contract_version="unknown"
trace_integrity="unknown"
identity_binding="unknown"
replay_determinism="unknown"
compliance_verdict="unknown"
risk_level="unknown"

if command -v jq >/dev/null 2>&1 && jq -e . "$report_json" >/dev/null 2>&1; then
  contract_name="$(jq -r '.contract.name // "unknown"' "$report_json")"
  contract_version="$(jq -r '.contract.version // "unknown"' "$report_json")"
  trace_integrity="$(jq -r '.compliance.trace_integrity // .trace_integrity // "unknown"' "$report_json")"
  identity_binding="$(jq -r '.compliance.identity_binding // .identity_binding // "unknown"' "$report_json")"
  replay_determinism="$(jq -r '.compliance.replay_determinism // .replay_determinism // "unknown"' "$report_json")"
  compliance_verdict="$(jq -r '.audit_summary.verdict // .verdict // "unknown"' "$report_json")"
  risk_level="$(jq -r '.audit_summary.risk_level // .risk_level // "unknown"' "$report_json")"
fi

skill_verdict="INCONCLUSIVE"
if [[ "$inspect_exit" -eq 0 ]]; then
  if [[ "$compliance_verdict" == "FAIL" ]]; then
    skill_verdict="REJECTED"
  elif [[ "$trace_integrity" == "verified" && "$identity_binding" == "ok" && "$replay_determinism" == "ok" ]]; then
    skill_verdict="ADMISSIBLE_CANDIDATE"
  else
    skill_verdict="REVIEW_REQUIRED"
  fi
else
  skill_verdict="INCONCLUSIVE_OR_REJECTED"
fi

cat >"$summary_md" <<EOF
# LTP Trace Audit Summary

## Scope
- Trace: \`$trace_abs\`
- Trace SHA-256: \`$trace_sha256\`
- Repository revision: \`$revision\`
- Strict mode: \`$strict\`

## Preliminary verdict
**$skill_verdict**

This is a mechanical preliminary classification. Apply the complete decision rules in
\`skills/ltp-agent-trace-auditor/references/verdict-rules.md\` before issuing a final verdict.

## Tool facts
- Inspector exit code: \`$inspect_exit\`
- Contract: \`$contract_name\` \`$contract_version\`
- Trace integrity: \`$trace_integrity\`
- Identity binding: \`$identity_binding\`
- Replay determinism: \`$replay_determinism\`
- Compliance verdict: \`$compliance_verdict\`
- Risk level: \`$risk_level\`

## Artifacts
- Inspector JSON: \`$report_json\`
- Inspector stderr: \`$stderr_log\`
- Metadata: \`$metadata_file\`
- Exact command: \`$command_file\`
EOF

printf 'LTP audit artifacts written to %s\n' "$out_dir"
printf 'Inspector exit code: %s\n' "$inspect_exit"
printf 'Preliminary verdict: %s\n' "$skill_verdict"

exit "$inspect_exit"

# LTP Skills

This directory contains reusable agent skills built on top of the LTP protocol and repository tooling.

## Available skills

### `ltp-agent-trace-auditor`

Audits AI-agent execution traces using deterministic LTP inspection, replay, continuity checks, action-boundary rules, and evidence-backed verdicts.

Start here:

- [`ltp-agent-trace-auditor/SKILL.md`](ltp-agent-trace-auditor/SKILL.md)

Supporting references:

- [`references/inspection-contract.md`](ltp-agent-trace-auditor/references/inspection-contract.md)
- [`references/verdict-rules.md`](ltp-agent-trace-auditor/references/verdict-rules.md)
- [`references/trace-format.md`](ltp-agent-trace-auditor/references/trace-format.md)

Runner:

```bash
bash skills/ltp-agent-trace-auditor/scripts/run-ltp-audit.sh <trace.jsonl> [output-dir]
```

Strict gate:

```bash
bash skills/ltp-agent-trace-auditor/scripts/run-ltp-audit.sh --strict <trace.jsonl> [output-dir]
```

## Design rule

Skills in this directory must preserve the core LTP boundary: LTP inspects and maintains orientation; it does not silently choose or execute actions on behalf of the audited agent.

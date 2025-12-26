# Agent Safety Examples

This directory contains examples of LTP Agent Traces demonstrating compliant and non-compliant behavior regarding Critical Actions.

## Files

- `blocked-critical.trace.jsonl`: **(PASS)** A trace where a critical action (`execute_code`) originating from a `WEB` context is correctly **blocked** by the admissibility layer. This represents a "Safe Agent".
- `allowed-critical.trace.jsonl`: **(FAIL)** A trace where a critical action (`execute_code`) originating from a `WEB` context is **allowed** (admissible: true). This represents an "Unsafe Agent" violation.

## Format

These files are in **JSONL** format (Newline Delimited JSON), where each line is a valid JSON object representing a `TraceEntry`.

## Usage

To verify the compliance of these traces using `ltp inspect`:

```bash
# Verify the Safe Agent (Expect PASS)
pnpm ltp:inspect --input examples/agents/blocked-critical.trace.jsonl --profile agents

# Verify the Unsafe Agent (Expect FAIL with Critical Violation)
pnpm ltp:inspect --input examples/agents/allowed-critical.trace.jsonl --profile agents
```

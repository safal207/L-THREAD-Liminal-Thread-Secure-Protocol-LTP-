# P0 Security Regression Suite

This directory contains permanent executable contracts for four confirmed
protocol-level security gaps. Each test was introduced as a red reproducer and must
remain green because the corresponding runtime boundary is now fixed.

## Covered findings

| ID | Contract | Closed by |
|---|---|---|
| P0-CANON-001 | Every SDK signs and hashes identical canonical bytes | Canonical Envelope v1, shared golden vectors, and differential edge tests |
| P0-STATE-002 | Rejected input cannot mutate committed security state | Python authentication-before-commit receive pipeline |
| P0-RUST-003 | The live Rust receive path enforces auth, replay, and chain checks | Verified live receive loop with wire-envelope chain commitment |
| P0-ELIXIR-004 | Elixir authenticates and validates chain state before dispatch | Atomic inbound security gate before application dispatch |

## Run locally

```bash
cd sdk/js
npm install --ignore-scripts
npm run build
cd ../python
python -m pip install -e ".[dev]"
cd ../..
python -m pytest -q tests/security/p0/test_p0_security_regressions.py
```

## Rules

- Do not mark these tests `xfail` or `skip`.
- Do not add `continue-on-error` to the workflow.
- Do not replace behavioral evidence with documentation assertions.
- Do not weaken a test oracle to accommodate an SDK divergence.
- Changes to a test oracle require an explicit security-review explanation.
- A regression in any contract blocks merge until the runtime boundary is repaired.

## Evidence lifecycle

```text
red reproducer
→ minimal protocol fix
→ green regression
→ cross-SDK differential verification
→ independent security re-review
→ permanent merge gate
```

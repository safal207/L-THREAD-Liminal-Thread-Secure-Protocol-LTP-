# P0 Security Regression Suite

This directory contains **red tests** for four confirmed protocol-level security gaps.
The tests express the required secure behavior and are intentionally expected to fail
on the current implementation.

## Covered findings

| ID | Contract | Current failure |
|---|---|---|
| P0-CANON-001 | Every SDK signs and hashes identical canonical bytes | JavaScript and Python serialize legal JSON numbers differently |
| P0-STATE-002 | Rejected input cannot mutate committed security state | Python updates `last_received_hash` before signature validation |
| P0-RUST-003 | The live Rust receive path enforces auth, replay, and chain checks | The receive loop only logs frames and contains a security TODO |
| P0-ELIXIR-004 | Elixir authenticates and validates chain state before dispatch | The real inbound path validates nonce shape but not signature/hash chain |

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
- A finding is closed only when its test passes because the runtime transition was fixed.
- Changes to a test oracle require an explicit security-review explanation.

## Expected lifecycle

```text
red reproducer
→ minimal protocol fix
→ green regression
→ cross-SDK differential verification
→ independent security re-review
```

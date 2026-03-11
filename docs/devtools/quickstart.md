# LTP DevTools Quickstart

## Install

```bash
pip install -e .
```

## Run replay inspection

```bash
ltp inspect trace tools/ltp-inspect/fixtures/replay/trace-replay.jsonl --replay --phase two_phase --color
```

Outputs:

- `trace.log` with `admissible`, `drift`, and `rejected` statuses.
- `assets/replay-demo.gif` generated from replay mode.

## Phase switches

- `--phase one_phase`: pre-generation prevention checks only.
- `--phase two_phase`: pre + post checks (recommended for production/audit).

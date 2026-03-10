# Two-Phase Semantic Inspector

## Modes

- `pre`: validate declared anchors against trace
- `post`: validate generated output against declared anchors
- `two_phase`: run pre then post
- `audit_only`: run both and log only

## CLI examples

```bash
# Phase 1 only
ltp inspect trace --phase pre --anchors-file anchors.json --trace samples/golden.trace.jsonl

# Phase 2 only
ltp inspect trace --phase post --output-file response.md --trace samples/golden.trace.jsonl

# Full two-phase
ltp inspect trace --phase two_phase \
  --anchors-file anchors.json \
  --output-file response.md \
  --trace samples/golden.trace.jsonl \
  --config .ltp/config.json
```

# WP6 Adversarial Invariants

## Required properties

### State safety

REJECT => state hash unchanged

### Migration safety

Invalid migration => no committed transition

### Replay safety

Repeated authenticated event => deterministic rejection

### Reproducibility

Same seed => same generated cases and verdicts

## Initial corpus

- empty envelope
- truncated frame
- invalid UTF-8
- unknown opcode
- oversized payload
- invalid schema version
- broken hash chain
- invalid migration state

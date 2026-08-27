# Contracts

This folder is the protocol’s enforceable surface.

- **Normative requirements:** [REQUIREMENTS.md](./REQUIREMENTS.md)
- **Canon ↔ Contract map:** [CANON_MAP.md](./CANON_MAP.md)
- **Machine-checkable schemas:** `*.schema.json`
- **Tool contract:** Inspector schema and output constraints
- **Request/outcome continuity:** [v0.1 contract and CLI](./request-outcome-continuity.v0.1.md)

Continuity v0.1 schemas:

- `ltp-request-envelope.v0.1.schema.json`
- `ltp-outcome-envelope.v0.1.schema.json`
- `ltp-request-outcome-continuity-input.v0.1.schema.json`
- `ltp-request-outcome-continuity-report.v0.1.schema.json`

Profiles:

- `core` — baseline conformance
- `fintech` — audit/integrity oriented checks
- `agentic` — critical action constraints (if enabled)

# ContractGraph-QA Smart Contract Continuity Bridge v0.1

ContractGraph-QA is an evidence producer and adapter. LTP remains the only
normative request/outcome continuity verifier.

```text
reviewed intent + EVM capture + reviewed receipt/event mapping
  -> ContractGraph-QA request/outcome envelopes
  -> LTP v0.1 schema validation
  -> verifyRequestOutcomeContinuity()
  -> continuity report
```

## Ownership boundary

ContractGraph-QA owns strict validation of the smart-contract intent, evidence
binding, deterministic projection, provenance, redaction, and non-claims. It
must not emit `CONTINUOUS`, `PENDING`, `DEFERRED`, or `BROKEN` as its own
verdict.

LTP owns envelope schemas, cross-record semantics, stable `0/1/2` CLI exit
codes, finding classification, and the final continuity report. LTP does not
prove authorization, response truth, external side effects, complete history,
or universal exactly-once execution.

## Normative command

```bash
pnpm -w ltp:continuity -- continuity-input.json --out continuity-report.json
```

The committed compatibility fixture is
`tools/lifecycle-integrity/fixtures/contractgraph-qa-smart-contract-continuity-v0.1.json`.
It is validated through the unmodified LTP v0.1 input schema and verifier.

## Downstream continuity

Indexer, backend, and API processing are represented as separate logical
requests/outcomes. An API response is not folded into an on-chain receipt
digest and cannot by itself complete the smart-contract request.

## Non-goals

Observed block/head/confirmation metadata does not establish canonical
finality. Repeated captures, receipt disappearance, block-hash replacement,
transaction replacement, reorg handling, finality policy, and multi-RPC
corroboration belong to a separate v0.2 contract. LTP v0.1 terminal statuses
are not extended with `MINED`, `FINALIZED`, `REORGED`, or `REPLACED`.

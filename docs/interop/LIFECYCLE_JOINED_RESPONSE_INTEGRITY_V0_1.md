# LTP Lifecycle-Joined Response Integrity v0.1

**Status:** Draft interoperability profile  
**Issue:** [LTP #480](https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-/issues/480)  
**Canonical profile:** [Liminal #108](https://github.com/safal207/Liminal/issues/108)

## Purpose

LTP already inspects deterministic traces and unsupported execution paths. This
profile adds a portable post-response verifier that can operate at three
explicit evidence levels:

```text
TEXT_HEURISTIC
OBSERVATION_JOINED
FULL_LIFECYCLE_JOINED
```

The implementation is intentionally separate from the existing `ltp inspect
trace` CLI. Existing trace inspection and text-only checks retain their current
behavior. The new module raises the evidence level only when portable records
are supplied.

## Files

- Verifier: [`tools/lifecycle-integrity/verify.ts`](../../tools/lifecycle-integrity/verify.ts)
- Fixtures: [`tools/lifecycle-integrity/fixtures/lifecycle-integrity-v0.1.json`](../../tools/lifecycle-integrity/fixtures/lifecycle-integrity-v0.1.json)
- Tests: [`tools/lifecycle-integrity/verify.test.ts`](../../tools/lifecycle-integrity/verify.test.ts)

Run:

```bash
pnpm test:lifecycle-integrity
```

## Evidence levels

### `TEXT_HEURISTIC`

The verifier may detect that response text matches or fails a declared pattern,
but it does not represent that match as proof. A text-only match emits:

```text
heuristic_result = MATCH
verdict = UNVERIFIABLE
```

This keeps fast portable hooks useful without confusing detection with
observation-backed evidence.

### `OBSERVATION_JOINED`

The claim is compared against one or more exact `observation_record` objects.
The verifier checks:

- canonical record reference;
- transition and subject binding;
- result digest;
- referenced JSON value or execution status.

Authority is reported as `NOT_EVALUATED` when the corresponding authorization
record is not supplied.

### `FULL_LIFECYCLE_JOINED`

The verifier additionally checks the supplied authorization record and every
observation-to-authorization edge:

```text
response claim
  -> observation record
  -> authorization record
```

The observation must repeat the same transition, subject, action identity, and
binding digest. LTP consumes this authority evidence but does not issue it.

## Claim verdicts

```text
SUPPORTED
CONTRADICTED
UNVERIFIABLE
OUT_OF_SCOPE
```

Every emitted claim includes:

```text
claim_id
claim_digest
observation_refs
evidence_level
required_record_refs
verdict
reason_code
heuristic_result (when applicable)
```

## Comparison rules

v0.1 implements:

- `TEXT_PATTERN_ONLY` — text detector; never treated as proof;
- `JSON_POINTER_EQUALS` — compares a value inside an observation result;
- `REFERENCE_PRESENT` — confirms the required observation references exist;
- `EXECUTION_STATUS_EQUALS` — verifies claims that a tool executed or was blocked;
- `OUT_OF_SCOPE` — preserves explicit non-evaluation.

## Independent dimensions

The report keeps these dimensions separate:

```text
authority
execution
response_integrity
```

Examples supported by the fixture pack:

```text
VALID + OBSERVED_EXECUTED + FAILED
DENIED + OBSERVED_BLOCKED + FAILED
EXPIRED_AT_REPORT + OBSERVED_EXECUTED + VERIFIED
NOT_EVALUATED + OBSERVED_EXECUTED + FAILED
```

A valid authorization cannot make a contradicted response pass. An honest
historical report cannot reactivate expired authority.

## Fixture coverage

The deterministic fixture pack includes:

1. fully joined supported transition;
2. plausible fabricated output that matches a text heuristic but contradicts the observation;
3. blocked action claimed as executed;
4. expired authorization with an honest report;
5. observation-joined count drift without imported authority;
6. missing citation binding;
7. mixed supported and unverifiable claims;
8. text-only heuristic detection that remains explicitly unverified.

Additional tests reject:

- tampered authorization references;
- tampered observation result digests;
- cross-transition observation substitution.

## Boundary

This profile proves deterministic comparison and the supplied record joins. It
does not prove policy correctness, authority-provider trust, observation-source
integrity, signer identity, complete model truthfulness, or production safety.

## Canonical invariant

> Text can trigger suspicion. Observation can support or contradict a claim.
> Authorization can establish whether the observed action was permitted. LTP
> reports all three without pretending any one of them proves the others.

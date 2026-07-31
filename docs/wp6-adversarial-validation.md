# LTP WP6 — Adversarial Validation

## Goal
Prove that LTP fails closed under adversarial inputs and malformed protocol states.

## Invariants

- Invalid input must not mutate state.
- Accepted transitions preserve protocol meaning.
- Downgrade attempts are rejected.
- Replay protection remains deterministic.
- Generated failures are reproducible from seed.

## Test layers

1. Property-based protocol generation.
2. Structured fuzzing of envelopes, capabilities, versions and migrations.
3. Mutation testing of security invariants.
4. Malformed-wire corpus.
5. Evidence artifact generation.

## Evidence

Every run records:

- seed
- case count
- outcome
- digest
- rejected reason code

# LTP Core Invariants (Normative)

The key words MUST, MUST NOT, SHOULD, and MAY
are to be interpreted as described in RFC 2119.

## 1. Explicit Orientation
- **Statement (MUST):** Orientation state MUST be explicit and monotonic with respect to the canonical transition index (or equivalent sequence/clock used for ordering).
- **Rationale:** Prevents hidden state and ensures continuity is reproducible and auditable.
- **Testability:** Conformance asserts presence of explicit orientation fields and verifies monotonic advance of the transition index across traces.

## 2. Replayable Transitions
- **Statement (MUST):** Transitions MUST be replayable deterministically from canonical inputs, excluding non-deterministic fields (e.g., wall-clock time, ephemeral IDs).
- **Rationale:** Ensures identical orientation evolution under controlled inputs and isolates non-determinism.
- **Testability:** Devtools replay transitions from canonical inputs and compare resulting orientation traces byte-for-byte, tolerating normalized non-deterministic fields.

## 3. Observable Drift
- **Statement (MUST):** Drift MUST be observable as a measurable delta from intended orientation at each transition.
- **Rationale:** Makes deviation detectable and attributable during audits.
- **Testability:** Conformance checks require drift metrics to be present, well-formed, and monotonically accumulated according to declared drift rules.

## 4. Constrained Futures
- **Statement (MUST):** Futures MUST be admissible only if they satisfy declared continuity constraints.
- **Rationale:** Prevents invalid branches and enforces consistency of future choices.
- **Testability:** Devtools validate admissibility decisions against declared constraints and flag any branch admitted in violation of constraints.

## 5. Replaceable Models, Persistent Continuity
- **Statement (MUST):** Models MAY change; continuity guarantees MUST persist independent of model implementation.
- **Rationale:** Decouples protocol continuity from specific model behavior.
- **Testability:** Conformance swaps model components (or simulates absence) while requiring identical orientation continuity and replay outcomes.

## Related documents
- [docs/glossary.md](./glossary.md)

LTP defines protocol invariants.
Everything else is implementation choice.

# LTP Requirements (Normative)

This document defines stable, testable requirements for LTP.
Requirement IDs MUST NOT change once published.

Legend:
- MUST: required for conformance
- SHOULD: strongly recommended
- MAY: optional

## Terminology (Normative)

LTP tracks **two different identities**:

- **principal identity** (`identity`): who is acting / on whose behalf (human, service, org).
- **thread identity** (`continuity_token`): which living thread/time-line a frame belongs to.

These MAY be equal in minimal demos, but SHOULD be treated as distinct axes in real systems.

Profiles:
- **core**: baseline conformance requirements
- **fintech**: adds audit/integrity expectations for regulated environments
- **agentic**: adds critical action constraints (if enabled by the implementation)

## Orientation (Core)

### LTP-REQ-ORIENT-IDENTITY-1 (MUST)
An Orientation frame MUST carry a stable `identity` for the principal (the actor / on whose behalf), not the executing model.

**Rationale:** orientation continuity is impossible without identity binding.

**Enforcement surfaces:**
- Schema: Orientation frame schema requires `identity` (or equivalent canonical field).
- Inspector: identity_binding suite.
- Verify/CI: conformance tests.

---

### LTP-REQ-ORIENT-CONTINUITY-TOKEN-1 (MUST)
All frames belonging to the same living thread MUST be bindable to the same continuity context via `continuity_token` (or an equivalent binding field).

**Enforcement:** Inspector trace parsing + binding checks.

**Note:** `continuity_token` identifies the **thread**; `identity` identifies the **principal** (see terminology above).

---

### LTP-REQ-ORIENT-CONSTRAINTS-1 (MUST)
Orientation MUST define constraints (what must not be broken) as a deterministic map/object.
If constraints appear in multiple locations (`constraints` and/or `payload.constraints`), canonicalization rules MUST be defined.

**Enforcement:**
- Schema: constraints field type = object/map
- Inspector: constraint normalization and strict mode behavior

---

### LTP-REQ-ORIENT-DRIFT-1 (SHOULD)
The protocol SHOULD expose a drift signal over time (scalar or structured), enabling detection of coherence degradation.

**Enforcement:** Inspector drift history extraction (if present).

---

### LTP-REQ-ORIENT-ADMISSIBLE-FUTURES-1 (SHOULD)
The protocol SHOULD represent a field of admissible futures (branch candidates) without selecting an action.

**Enforcement:** Inspector futures block present when provided; Verify ensures structural validity.

---

## Non-Goals (Hard Boundaries)

### LTP-REQ-NONGOAL-NO-DECISION-1 (MUST)
LTP conformance MUST NOT require choosing an action/branch. LTP MUST be able to operate as an orientation layer independent of decision-making.

**Enforcement:**
- Canon constraints
- Contract docs: explicit non-goal
- Tooling: Inspector never emits commands; only observations

---

### LTP-REQ-NONGOAL-NO-MODEL-EXEC-1 (MUST)
Conformance MUST NOT require executing a model. LTP MUST be inspectable from traces alone.

**Enforcement:** Inspector is read-only; CI runs without inference.

---

### LTP-REQ-NONGOAL-NO-HEURISTIC-ADAPT-1 (MUST)
Inspector/verification tooling MUST NOT adapt heuristically to “fix” meaning. Only canonicalization of representation is allowed, and MUST be deterministic and explicitly reported.

**Enforcement:** strict mode escalates canonicalization to error.

---

## Trace Format & Versioning

### LTP-REQ-TRACE-JSONL-1 (MUST)
Traces MUST be represented as JSONL (one JSON object per line). Legacy JSON arrays are non-conformant.

**Enforcement:** Inspector parser rejects arrays; emits conversion hint.

---

### LTP-REQ-TRACE-SINGLE-OBJECT-PER-LINE-1 (MUST)
Each JSONL line MUST contain exactly one JSON object.

**Enforcement:** Inspector parser rejects `}{` multi-object lines.

---

### LTP-REQ-TRACE-VERSION-1 (MUST)
Each frame MUST declare a supported trace version (`v` or `version`).
Mixed versions within a trace MUST be rejected.

**Enforcement:** Inspector version checks + fixtures.

---

### LTP-REQ-TRACE-ORDER-DETERMINISM-1 (SHOULD)
If branch lists or maps exist, their canonical ordering MUST be deterministic.
Non-canonical ordering SHOULD be normalized with warnings; MUST fail under `--strict`.

**Enforcement:** Inspector normalization + exit codes.

---

## Audit & Integrity (Regulated / Enterprise)

### LTP-REQ-AUDIT-HASH-CHAIN-1 (SHOULD)
LTP SHOULD support tamper-evident audit logs via hash-chaining of entries (`prev_hash`, `hash`).

**Enforcement:** Inspector compliance profile checks.

---

### LTP-REQ-AUDIT-NONREPUDIATION-1 (MAY)
LTP MAY support signed roots (e.g., Ed25519) for non-repudiation.

**Enforcement:** Inspector signature presence/verification (if implemented).

---

## Inspector Semantics (Tool Contract)

### LTP-REQ-INSPECT-EXPLAIN-1 (MAY, DRAFT)
Inspector MAY provide human-readable explanations for a specific step (`explain --at ...`) without prescribing actions.

**Constraints:**
- Explanations MUST be derived only from trace fields.
- Explanations MUST be deterministic for the same input trace.

**Enforcement:** CLI tests (matrix) when stabilized.

### LTP-REQ-INSPECT-EXIT-CODES-1 (MUST)
Inspector MUST use stable exit codes for CI:
- 0: OK
- 1: warnings/normalization/degraded signals
- 2: error (invalid input, contract violation, or runtime failure)

**Enforcement:** docs + test matrix.

---

### LTP-REQ-INSPECT-NO-BANNER-IN-QUIET-1 (MUST)
With `--quiet`, Inspector MUST suppress banners/RESULT lines while preserving primary report output.

**Enforcement:** test matrix + snapshot tests.

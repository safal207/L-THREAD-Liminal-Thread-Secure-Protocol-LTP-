# LTP Protocol Review & Formalization (v0.1)

## 1. Consistency Analysis
- **Core primitives (per README v0.1):** Orientation, Route Response/branches, Focus Snapshot, canonical Frames (`hello`, `heartbeat`, `orientation`, `route_request`, `route_response`, `focus_snapshot`).
- **Derived/control:** Canonical flow ordering, deterministic replay rules, and branch categories (`primary`, `recover`, `explore`).
- **Coherence:**
  - Orientation precedes routing and is referenced by explainability factors; no conflicting duties.
  - Route Response carries multiple branches and is normalized; branch categories do not overlap with Orientation semantics.
  - Focus Snapshot is telemetry/diagnostic and does not drive routing, avoiding overlap.
- **Gaps/Ambiguities:**
  - "Focus node" and "drift"/"continuity" appear in conceptual framing but are not defined in the v0.1 surface; responsibilities vs. Orientation/Route Response are unclear.
  - Relationship between Orientation and Focus Snapshot (e.g., is snapshot a point-in-time view of Orientation?) is implicit, not specified.

## 2. Missing Definitions
- **Primitive: Focus Node**
  - *Missing:* Formal definition and invariants.
  - *Proposed:* Identify the authoritative compute locus for Orientation evaluation and routing decisions. Invariant: a frame sequence MUST identify the active focus node ID; only that node may emit `route_response` for the associated `route_request`.
- **Primitive: Drift**
  - *Missing:* Quantification of divergence between intended Orientation and observed state.
  - *Proposed:* Define drift as a scalar or structured metric attached to `focus_snapshot`, computed against a declared expected Orientation hash. v0.1 treats drift as informational only—no monotonicity or cross-implementation invariant is required.
- **Primitive: Future Branch**
  - *Missing:* Frame/field-level representation beyond `primary/recover/explore` labels.
  - *Proposed:* Treat each branch as `{id, path, confidence?, rationale, constraints}`. Invariant: at least one branch MUST be marked `primary`; confidence values are OPTIONAL but if present MUST be within `[0.0, 1.0]`. Normalization is tooling-only, not a protocol requirement.
- **Primitive: Continuity**
  - *Missing:* Persistence/chain rule tying frames across sessions.
  - *Proposed:* Define continuity token carried in all frames after `hello`; token binds Orientation to Route Requests/Responses. Invariant: token MUST be stable across retries within a session and rotation is FORBIDDEN mid-session in v0.1; rotation is allowed only at explicit session boundaries.
- **Primitive: Orientation**
  - *Missing:* Serialization contract and mutability rules.
  - *Proposed:* Orientation payload MUST be JSON object with declared schema version; updates MUST be idempotent within a sequence number; hash of Orientation SHOULD be included in `route_request` for replay verification.

## 3. RFC v0.1 Outline (Skeleton)
1. **Introduction**
2. **Terminology** (Orientation, Focus Node, Focus Snapshot, Drift, Future Branch, Continuity Token, Frame)
3. **Architecture Overview**
   - Roles: client, focus node, relay/observer
   - Transport bindings: WebSocket, REST
4. **Core Protocol**
   - Frame types (`hello`, `heartbeat`, `orientation`, `route_request`, `route_response`, `focus_snapshot`)
   - Canonical flow ordering and required fields
   - Continuity token handling
5. **Core Primitives**
   - Formal definitions and invariants (Orientation, Focus Node, Future Branch, Drift, Continuity)
6. **Determinism & Replay**
   - Hashing of Orientation and Route Responses
   - Normalization of branch arrays/maps
7. **Invariants**
   - Required frame sequencing
   - Single authoritative focus node per continuity token
   - Optional confidence values on branches MUST respect `[0.0, 1.0]` when present; normalization is tooling-driven
8. **Failure Semantics**
   - Handling of missing/unknown frame types (warn vs fail)
   - Timeout and heartbeat loss behavior
   - Replay mismatch handling
9. **Security & Abuse Considerations**
   - Authenticity of frames; tamper-evident hashes
   - Resource exhaustion (heartbeat abuse); drift tampering risks
10. **Optional Extensions**
    - Explainability tags, HUD/UX helpers
    - Rich branch metadata
11. **Conformance**
    - Test vectors and expected-negative fixtures
12. **Non-Goals**
    - No recommendations/ML inference rules; no black-box scoring
13. **IANA / Registry Considerations (if any)**

## 4. Minimal Reference Sidecar Proposal
- **Purpose:** Enforce canonical flow, compute hashes for replay, and expose diagnostics without altering application logic.
- **Data Structures:**
  - `Frame` object with `id`, `ts`, `type`, `payload`, `continuity_token`, optional `seq`.
  - `Orientation` record (versioned schema) with hash for replay.
  - `Branch` record `{id, class(primary|recover|explore), confidence?, rationale, path}` where confidence values, if present, stay within `[0.0, 1.0]`.
  - `Snapshot` record capturing Orientation hash, drift metric, and heartbeat status.
- **Interfaces:**
  - Input: subscribe to application events to emit frames; ingest incoming frames from transport.
  - Output: normalized `route_response`, replay logs, conformance report (JSON).
  - API surfaces: `ingestFrame(frame)`, `validateSequence()`, `computeDrift(snapshot)`, `exportReplay(logFormat)`.
- **Observability/Replays:**
  - Persist ordered frames with hashes; expose deterministic replayer that revalidates continuity token, sequence, and branch normalization.
  - Emit warnings on unknown frame types; fail on invariant violations.

## 5. Critical Assessment
- **Implementability:** Conceptually implementable as a deterministic framing and replay layer; relies on clear invariant definitions above.
- **Highest Technical Risk:** Ambiguity around Focus Node authority and continuity tokens could cause divergent implementations and interoperability failures.
- **Hardest to Standardize:** Drift measurement and Future Branch confidence semantics—without strict definitions, scores and branch normalization will vary across stacks.
- **Scope to Simplify for v0.1:**
  - Defer drift to an informational metric without cross-node invariants.
  - Fix branch schema to `{id, class, path}` with optional confidence to reduce interoperability risk and keep values within `[0.0, 1.0]` when present.
  - Mandate a single continuity token per session and forbid mid-session rotation.

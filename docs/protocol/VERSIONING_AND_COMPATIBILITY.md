# LTP Versioning and Compatibility Policy

**Status:** normative WP5 policy  
**Registry:** `config/protocol-capabilities.json`  
**Generated matrix:** `docs/protocol/generated/SUPPORTED_VERSION_MATRIX.md`

## 1. Version identity

LTP protocol versions use numeric `MAJOR.MINOR.PATCH`. SDK package versions and protocol versions are separate identities. A package may implement more than one protocol version.

The capability registry is the source of truth for:

- wire-supported, candidate, legacy and deprecated versions;
- snapshot-schema identity;
- canonical-envelope identity;
- required and optional capabilities;
- declared state migrations.

A version marked `candidate` is not wire-supported until its interoperability and release gates pass. In this repository, `1.0.0` is the normative candidate profile; the currently exercised wire profiles remain `0.3.0` and `0.6.0`.

## 2. Negotiation

A client sends an ordered set of supported protocol versions, offered capabilities, any client-required capabilities and an optional minimum security version. The server:

1. validates strict semantic-version syntax;
2. intersects the client set with registry entries marked `wire_supported`;
3. removes versions below the explicit security floor or prior-session version;
4. selects the highest remaining common version;
5. verifies every server-required capability is offered by the client;
6. verifies every client-required capability is known and available in the selected profile;
7. evaluates same-session state compatibility or an explicit migration.

No common version produces `UNSUPPORTED_VERSION`. A common version below the floor produces `DOWNGRADE_BLOCKED`; the implementation must not silently fall back.

## 3. Capability classes

Every normative v1 capability is registered with an owner, lifecycle status and one class:

- **required** — absence changes protocol security or semantics; negotiation fails closed;
- **optional** — endpoints may omit it without changing required semantics.

Unknown optional capabilities may be ignored. Unknown required capabilities produce `UNKNOWN_REQUIRED_CAPABILITY`. A known capability unavailable in the selected version produces `REQUIRED_CAPABILITY_UNAVAILABLE`. A client that omits a server-required capability produces `MISSING_REQUIRED_CAPABILITY`.

Security capabilities cannot be downgraded from required to optional in a minor or patch release.

## 4. Version-change classification

### Patch

A patch release may clarify text, repair an implementation defect or add non-normative evidence without changing required or optional protocol surface. It must not:

- remove a capability or stable reason code;
- promote an optional capability to required;
- change snapshot schema or canonical-envelope identity.

### Minor

A minor release may add optional capabilities and stable reason codes while preserving all existing required semantics and state compatibility.

### Major

A major release is required for removal or promotion of capabilities, removal of stable reason codes, canonical-envelope changes, snapshot-schema changes or any transition that changes accepted security semantics.

`tools/versioning/surface.ts` enforces these declarations. A breaking surface hidden behind a patch or minor bump fails with `UNDECLARED_PROTOCOL_BREAK`.

## 5. Same-session resume and state migration

A same-version resume is allowed only when protocol version, snapshot schema and canonical-envelope identity all match.

Cross-version resume requires an exact migration entry declaring:

- source and target protocol versions;
- source and target snapshot schemas;
- compatible or breaking classification;
- whether explicit approval is required;
- whether session identity may be preserved.

A missing rule produces `INCOMPATIBLE_STATE_VERSION`. A breaking rule without its exact approval identifier produces `MIGRATION_REQUIRED`. Resume to a lower version produces `DOWNGRADE_BLOCKED`.

Compatible migration `state-v1-0.3-to-0.6` preserves session identity. Candidate migration `state-v1-to-v2-1.0` is breaking, requires explicit approval and starts a new session identity.

## 6. Deprecation and rollout

A wire-supported version moves through `current -> legacy -> deprecated -> removed`.

- Deprecation must be announced for at least one minor release and 90 calendar days, whichever is longer.
- During the window, generated compatibility evidence must continue covering the version.
- Removal is a major change unless the version was already outside the published support contract.
- Partial rollout must keep a common version available. Sessions cannot switch protocol semantics after handshake without an explicit migration transition.

## 7. Stable negotiation reason codes

- `INVALID_VERSION`
- `UNSUPPORTED_VERSION`
- `UNKNOWN_REQUIRED_CAPABILITY`
- `MISSING_REQUIRED_CAPABILITY`
- `REQUIRED_CAPABILITY_UNAVAILABLE`
- `DOWNGRADE_BLOCKED`
- `INCOMPATIBLE_STATE_VERSION`
- `MIGRATION_REQUIRED`

Reason-code removal is a breaking change. Additions require at least a minor version unless they only refine a previously non-normative diagnostic.

## 8. Generated evidence

The permanent WP5 gate runs fixture-driven tests and generates:

- `artifacts/wp5-version-compatibility.json`;
- `artifacts/wp5-version-migration-evidence.json`;
- the checked-in generated Markdown compatibility matrix.

The checked-in matrix is validated against executable fixtures. A handwritten table without matching test generation is not release evidence.

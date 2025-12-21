# Frozen Core Compliance Checklist

- All referenced canonical artifacts **MUST** be reachable, versioned, and pinned to stable paths; broken links or drifting references **MUST NOT** ship.
- Invariant definitions **MUST** be cross-checked against the latest canonical trace and checks to confirm continuity, admissibility, drift handling, identity stability, and replayability.
- Every transition in the trace **MUST** preserve declared invariants; any deviation **MUST** be documented with scope, impact, and mitigation before release.
- Replay procedures **MUST** prove deterministic behavior without introducing side effects or mutable external dependencies.
- Verification steps **SHOULD** include automated link validation and structural checks for missing anchors or renamed sections.
- Failure modes **MUST** be explicit: silent failures, swallowed errors, or unlogged recoveries **MUST NOT** be present in trace ingestion, validation, or replay paths.
- Observability hooks (logging/metrics) **SHOULD** detect and surface unexpected state transitions, drift accumulation anomalies, and identity inconsistencies.
- Any conditional logic in compliance tooling **MUST** default to safe failure with clear operator guidance rather than continuing execution silently.

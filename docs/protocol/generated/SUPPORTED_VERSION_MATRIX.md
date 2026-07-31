# Generated LTP Version Compatibility Matrix

> Generated from `fixtures/versioning/negotiation-cases.json`; do not edit by hand.

| Case | Client versions | Floor | Result | Selected | Reason | Resume |
|---|---|---|---|---|---|---|
| current-0.6-selects-highest-common | 0.3.0, 0.6.0 | — | PASS | 0.6.0 | NEGOTIATED | — |
| legacy-0.3-remains-explicitly-supported | 0.3.0 | — | PASS | 0.3.0 | NEGOTIATED | — |
| no-overlap-fails-closed | 2.0.0 | — | PASS | — | UNSUPPORTED_VERSION | — |
| unknown-required-capability-fails-closed | 0.6.0 | — | PASS | — | UNKNOWN_REQUIRED_CAPABILITY | — |
| missing-server-required-capability-fails | 0.6.0 | — | PASS | — | MISSING_REQUIRED_CAPABILITY | — |
| security-floor-blocks-silent-downgrade | 0.3.0 | 0.6.0 | PASS | — | DOWNGRADE_BLOCKED | — |
| known-required-capability-unavailable | 0.3.0 | — | PASS | — | REQUIRED_CAPABILITY_UNAVAILABLE | — |
| same-version-resume | 0.6.0 | — | PASS | 0.6.0 | NEGOTIATED | RESUME |
| compatible-resume-transition | 0.6.0 | — | PASS | 0.6.0 | NEGOTIATED | MIGRATE |

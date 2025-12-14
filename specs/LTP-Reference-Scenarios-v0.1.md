# LTP v0.1 Reference Scenarios

The following scenarios provide deterministic, minimal flows that align with the v0.1 specs. They can be mirrored in conformance kits or used as onboarding exercises.

## 1. Basic routing under stable focus

- **Purpose:** Demonstrate a steady v0.1 sequence that yields a multi-branch route under normal conditions.
- **Context:**
  - Single client initiating routing against a responsive server.
  - Stable focus and no prior debt in the session.
- **Frames:**
  1. `hello`
  2. `heartbeat`
  3. `orientation`
  4. `route_request`
  5. `route_response`
- **Expected outcome:**
  - Returns at least 2 branches with a clear primary selection.
  - Confidence values sum to ~1.0 and include a meaningful rationale per branch.
  - Sequence matches canonical order without retries.
- **Notes:**
  - Can optionally append a `focus_snapshot` if the implementation surfaces focus strength.

## 2. Degraded load: graceful downgrade

- **Purpose:** Show that routing stays usable when the node is under load.
- **Context:**
  - Heartbeat indicates elevated load or backlog.
  - Orientation and route request remain simple and deterministic.
- **Frames:**
  1. `hello`
  2. `heartbeat`
  3. `orientation`
  4. `route_request`
  5. `route_response`
- **Expected outcome:**
  - Route response still returns multiple branches but with reduced confidence spread and/or shallower paths.
  - Selection may shift to a safer or recovery branch.
  - Degrades gracefully without forced silence or crash.

## 3. Out-of-order protection (negative case)

- **Purpose:** Validate rejection when ordering is broken.
- **Context:**
  - Client emits a `route_request` before completing the hello/orientation gate.
- **Frames:**
  1. `route_request`
  2. `hello`
  3. `heartbeat`
- **Expected outcome:**
  - Expected: FAIL in conformance kit.
  - Flow is rejected or flagged as invalid without progressing to routing.
  - No implicit repair of ordering.

## 4. Duplicate id protection (negative case)

- **Purpose:** Validate handling of repeated frame identifiers.
- **Context:**
  - Client sends two frames sharing the same `id` within one sequence.
- **Frames:**
  1. `hello`
  2. `hello` (duplicate `id`)
  3. `heartbeat`
- **Expected outcome:**
  - Expected: FAIL in conformance kit.
  - Duplicate is rejected or logged as an integrity fault.
  - No silent overwrite of the first frame.

## 5. Wrong version rejection (negative case)

- **Purpose:** Show that mismatched protocol versions are rejected.
- **Context:**
  - Client uses `v: "9.9"` while the server is locked to v0.1.
- **Frames:**
  1. `hello`
  2. `heartbeat`
- **Expected outcome:**
  - Expected: FAIL in conformance kit.
  - Version mismatch is surfaced; flow does not proceed to orientation or routing.
  - Error is deterministic and does not downgrade silently.

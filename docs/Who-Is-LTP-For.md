# Who Is LTP For?

LTP is a transport-agnostic protocol for orientation and routing. It keeps clients and services in sync on where they are, where they intend to go, and which branch to take next—even when the underlying transport or runtime shifts.

## Infrastructure / platform teams

**Pain:** Fragmented service meshes and gateways make it hard to express intent, evaluate route quality, and prove compatibility across stacks.

**What LTP gives:** A minimal frame vocabulary (hello, heartbeat, orientation, route_request/route_response) that keeps routing intent consistent across transports. Focus snapshots and heartbeats give live posture without custom glue code.

**First step:** Run the canonical flow or the new scenario scripts with ts-node to see deterministic branches, then map the frame payloads onto your service boundary model.

## AI agent platforms

**Pain:** Agents swap between tools and transports, but coordination often relies on ad-hoc JSON contracts and brittle sequencing.

**What LTP gives:** A locked v0.1 frame ordering that keeps agent orientation explicit and routes measurable. Confidence-bearing route_response payloads support planning and failover without bespoke policy engines.

**First step:** Mirror the basic routing scenario, confirm ordering with the conformance kit, and plug the route_response into your planner’s branch selector.

## High-risk decision systems

**Pain:** Systems that gate safety or money need deterministic audits of how routing choices were made and whether fallbacks were available.

**What LTP gives:** Canonical sequencing plus structured rationales per branch, making it clear why a route was chosen and how it degrades. Version locks prevent silent drift between components.

**First step:** Run the degraded-load scenario, observe the confidence spread, and pin the same frames into your review pipeline for repeatability.

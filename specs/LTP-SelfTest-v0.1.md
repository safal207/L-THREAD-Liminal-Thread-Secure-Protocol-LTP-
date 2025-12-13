# LTP Self-Test Harness v0.1

This document defines the canonical self-test sequence that any node, SDK, or HUD can run to assert conformance with LTP v0.1. The goal is a deterministic in-memory flow that CI can execute without external dependencies.

## Canonical sequence

The self-test uses a fixed sequence of frames stored in `specs/vectors/self-test-canonical.v0.1.json`. All timestamps are deterministic integers and the protocol version is pinned to `v=0.1`.

1. **hello** — must be the first frame. Establishes the session and gates all subsequent frames.
2. **heartbeat ×3** — three heartbeats with strictly increasing `seq` values (1, 2, 3).
3. **orientation** — provides `mode`/`focus` context after heartbeats are established.
4. **route_request → route_response** — a request followed by a response that exposes at least two candidate branches (the canonical vector provides three: `primary`, `recover`, and `explore`).
5. **optional focus_snapshot** — emitted after routing to surface current focus.
6. **unknown frame type** — ignored without throwing.
7. **duplicate id** — ignored via per-session deduplication to prevent repeat side effects.

## Required assertions

A conformant implementation of the harness MUST:

- Enforce **hello gating**: the first valid frame must be `hello` and carry `v=0.1`.
- Preserve **per-session ordering**: heartbeats are accepted only after `hello` and must have monotonically increasing `seq` values within the session.
- **Ignore unknown frames** without throwing, while still counting them as received.
- **Validate protocol version** of every processed frame (`v=0.1`).
- **Deduplicate by id per session**: repeated frame ids must not trigger side effects or be processed twice.
- Verify **branch coverage**: a `route_response` must surface at least two branches.
- Remain **deterministic**: identical input yields identical outcomes and a stable determinism hash.

## Expected outputs

A successful run of the canonical harness produces a report with:

- Total frames **received** and **processed** (post-deduplication).
- Count of **emitted** frames (responses produced by the harness itself).
- **Branch count** observed in the `route_response` (≥2 required).
- A stable **determinism hash** derived from the canonical flow state.
- A **conformance level** derived from `specs/LTP-Conformance-Endpoint-v0.1.md` and attached to the report:
  - **LTP-Core** – basic frame handling and ordering enforced (hello gating, version check, dedupe).
  - **LTP-Flow** – LTP-Core + canonical routing behavior (route_request/route_response with ≥2 branches).
  - **LTP-Canonical** – LTP-Flow + fully passing self-test (no errors, deterministic outcomes).
- An empty **errors** list; any violation marks the run as failed and explains the reason.

The harness performs no network I/O and uses only deterministic data so CI results are reproducible.

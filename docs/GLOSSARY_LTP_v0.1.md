# LTP v0.1 Glossary

- **Frame:** Minimal self-describing message envelope carrying version, id, timestamp, type, and payload; base unit of LTP.
- **Canonical Flow:** Deterministic reference sequence of frames (hello → heartbeat → orientation → route_request → route_response → optional focus_snapshot) that all implementations reproduce for the same inputs.
- **Conformance:** Testable requirements for frame support, ordering, determinism, explainable routing, and silence-as-signal handling across nodes, clients, agents, and HUDs.
- **Orientation:** Semantic posture of a line, expressed via `orientation` frames (mode, focus, vector) to ground routing decisions.
- **Route branches:** The alternative futures returned in `route_response`, each with an id and confidence.
- **TimeWeave:** Temporal connective tissue across frames enabling continuity without prescribing storage; keeps ordering and replay coherent.
- **Future Weave:** Anticipated sequence of possible futures implied by `route_response` branches and subsequent orientation updates.
- **Silence-as-signal:** Interpreting absence of frames as meaningful state (no forced responses), preserving deterministic behavior.
- **Determinism:** Property that identical inputs produce the same ordered frames and branch confidences across implementations.
- **Explainability:** Ability to trace routing outcomes to inputs, constraints, and observed orientation without opaque randomness.
- **Node:** Routing/orienting component that processes route requests and emits responses; often server-side.
- **Client:** Initiating component that sends `hello`, `heartbeat`, and `route_request`, and consumes responses.
- **Agent:** Autonomous client role that participates in the canonical flow and may act on route branches.
- **HUD:** Observability surface consuming `focus_snapshot` and orientation signals for visualization and diagnostics.

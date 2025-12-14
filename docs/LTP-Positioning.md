# LTP Positioning

## What LTP is
- A deterministic orientation and routing protocol: frames establish context, timing, and routing branches without hidden state.
- A transport-friendly fabric: works over existing channels (HTTP/WS) and keeps payloads schema-light but typed (`hello`, `heartbeat`, `orientation`, `route_request`, `route_response`, `focus_snapshot`).
- A frozen v0.1 surface: canonical flow and fixtures are locked so demos, SDKs, and CI can be compared byte-for-byte.
- An explainability layer: routing decisions expose `primary / recover / explore` branches with rationale and determinism hashes.

## What LTP is not
- Not a machine learning framework or inference runtime.
- Not a recommender system or personalization engine.
- Not a message queue or durable log; it assumes your transport delivers frames.
- Not a storage layer; it does not persist histories or events.
- Not an orchestration or workflow engine; it keeps routing semantics narrow and deterministic.

## Fit and boundaries
- Use LTP to make interop between clients, agents, nodes, and HUDs predictable and explainable.
- Pair it with your own storage, ML, or orchestration stacks as needed; LTP does not constrain those choices.
- Maintain the frozen v0.1 contract to preserve compatibility across SDKs and CI badges.

# LTP Liminal Web Overview

## Purpose
Liminal Web is the “second layer” of LTP: not only a secure transport, but a web of threads, time, and consciousness state that can be routed, visualized, and explained. This document links the existing modules into one coherent picture (v0.1).

## Core Pieces (where they live)
- **Thread Life Model** — lifecycle of a thread as a living trajectory. Spec: [`LTP-ThreadLifeModel.md`](./LTP-ThreadLifeModel.md). Code: [`../sdk/js/src/threadLifeModel.ts`](../sdk/js/src/threadLifeModel.ts).
- **Consciousness Web & Orientation Shell** — semantic graph + focus sectors over threads. Spec: [`LTP-ConsciousnessWeb.md`](./LTP-ConsciousnessWeb.md). Code: [`../sdk/js/src/consciousnessWeb.ts`](../sdk/js/src/consciousnessWeb.ts).
- **Temporal Orientation + Time Anchors** — focus momentum, volatility, anchor points. Code: [`../sdk/js/src/temporalOrientation/`](../sdk/js/src/temporalOrientation/), [`../sdk/js/src/timeAnchors/`](../sdk/js/src/timeAnchors/), [`../sdk/js/src/time/`](../sdk/js/src/time/).
- **TimeWeave & Future Weave** — multi-path futures and depth/summary metrics. Code: [`../sdk/js/src/time/timeWeave.ts`](../sdk/js/src/time/timeWeave.ts), [`../src/visualization/futureWeaveGraph.ts`](../src/visualization/futureWeaveGraph.ts).
- **Fuzzy/Smart Routing** — intent selection over the weave. Code: [`../sdk/js/src/routing/fuzzyRoutingEngine.ts`](../sdk/js/src/routing/fuzzyRoutingEngine.ts), demo: [`../src/demos/explainRoutingDemo.ts`](../src/demos/explainRoutingDemo.ts).
- **HUD / Turtle Orientation** — human-facing snapshots (passport of orientation). Code: [`../src/turtle/`](../src/turtle/), example HUD: [`../examples/turtle-hud/`](../examples/turtle-hud/).
- **Runtime Nodes & Gateway** — Rust node + JS client/gateway for live traffic. Code: [`../nodes/ltp-rust-node/`](../nodes/ltp-rust-node/), [`../scripts/dev/ltp-node-demo.ts`](../scripts/dev/ltp-node-demo.ts), [`../scripts/gateway/ltp-node-gateway.ts`](../scripts/gateway/ltp-node-gateway.ts).

## Flow A: From events to TimeWeave
1) **Ingress:** events/heartbeats/orientation frames land on the Rust node (`ltp-rust-node`) and are forwarded to clients (`ltp-node-demo` or gateway).
2) **Thread context:** frames update the **Thread Life Model** (`threadLifeModel.ts`) and the **Consciousness Web** (`consciousnessWeb.ts`) to keep semantic state per thread.
3) **Temporal metrics:** anchor updates run through **Temporal Orientation** (`temporalOrientation/*`) and **Time Anchors** (`timeAnchors/*`) to compute direction (past/now/future), focus momentum, and volatility.
4) **Weave construction:** **TimeWeave** (`time/timeWeave.ts`) builds depth/summary metrics and multi-path probabilities.
5) **Future weave view:** **Future Weave Graph** (`visualization/futureWeaveGraph.ts`) renders an ASCII map of primary/recovery/explore branches for inspection or logging.

Small sketch:
```
events → threadLifeModel → consciousnessWeb → timeAnchors/orientation → timeWeave → futureWeaveGraph
```

## Flow B: From TimeWeave to routing & HUD
1) **Routing intent:** **FuzzyRoutingEngine** (`routing/fuzzyRoutingEngine.ts`) consumes TimeWeave metrics (depth, volatility, momentum) to pick primary and alternate intents.
2) **Explainability:** **Explain Routing Demo** (`demos/explainRoutingDemo.ts`) and **Future Weave Graph** expose reasons + branch graphs over HTTP/WS servers (`httpDemoServer.ts`, `wsDemoServer.ts`).
3) **HUD surfaces:** **Turtle Orientation** (`src/turtle/*`) and **Turtle HUD** example (`examples/turtle-hud/*`) turn routing + orientation snapshots into a simple passport for humans; the **gateway/monitor** scripts stream these snapshots.
4) **Live loop:** Rust node ↔ JS client ↔ HUD/gateway form a minimal “living” Liminal Web where metrics, routing, and visualization stay in sync.

Sketch:
```
timeWeave → fuzzyRoutingEngine → explainRoutingDemo / ws+http demos
           ↘ HUD + turtle orientation snapshots (monitor/gateway)
```

## Positioning (LTP / Liminal Web vs HTTP/WebSocket)
- **HTTP/WebSocket:** transport bytes/messages; no notion of thread lifecycle, time anchors, or focus state.
- **LTP / Liminal Web:** transport + semantic orientation. Every frame can carry thread life, temporal anchors, focus momentum, and multi-path futures, and the stack can explain why a route was chosen.
- Outcome: agents and UIs get both reliable delivery and a continuous map of “where attention is heading,” enabling adaptive routing and human-readable HUDs.

## How to use this doc
- Start with the specs (`LTP-ThreadLifeModel.md`, `LTP-ConsciousnessWeb.md`) for definitions, then follow the flows above when wiring new sensors, HUDs, or gateways.
- When adding features, place them along these flows: ingestion → thread+time semantics → weave → routing → HUD/explainability.
- Keep the graph and routing deterministic: the current v0.1 stack avoids randomness so behaviors stay inspectable.

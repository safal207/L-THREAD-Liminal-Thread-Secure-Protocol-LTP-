# L-THREAD / LTP (Liminal Thread Protocol)

**Version:** 0.6.0-alpha.3
**Status:** Production-Ready (Enterprise) | Security Hardened

## Overview

L-THREAD (Liminal Thread Protocol) is a secure transport layer designed for the LIMINAL ecosystem. It serves as a "liminal thread" - a protected communication channel between human devices and LIMINAL OS that preserves context, intent, and inner state throughout the interaction.

### Ethos

> I am not building a system that knows for you.
> I am creating a space where you can see where you are and choose your own path.

LTP was created by Aleksey Safonov, inviting builders to orient themselves and choose the path that fits their context.

📖 **Documentation:**
- [Architecture Overview](./ARCHITECTURE.md) - Ecosystem architecture and SDK comparison
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment strategies
- [API Reference](./API.md) - Complete API documentation for all SDKs
- [Protocol Specifications](./specs/) - Detailed protocol specifications
- [Liminal Web Overview](./specs/LTP-Liminal-Web-Overview.md) - How thread, time, and consciousness layers fit together
- [Consciousness Web & Orientation Shell](./specs/LTP-ConsciousnessWeb.md) - Semantic graph + focus layer built atop the Thread Life Model
- [LTP Flow v0.1 (Draft)](./specs/LTP-Flow-v0.1.md) - Living, orientable motion of frames across time
- [LTP Canonical Flow v0.1 (Draft/Frozen)](./specs/LTP-Canonical-Flow-v0.1.md) - Deterministic reference sequence for routing
- [Project Map](./PROJECT_MAP.md) - Single entry point for specs, SDKs, nodes, and demos. **If you're new, start here.**
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute to LTP
- [Changelog](./CHANGELOG.md) - Version history and changes
- [Security Policy](./.github/SECURITY.md) - Security reporting and best practices

LTP Flow v0.1 is the connective tissue for how frames travel, branch, and survive reconnects without assuming storage or ML; it keeps routing explainable while letting silence and load shape the rhythm. Read it as a living standard alongside the Frames spec to orient any client, node, or HUD quickly.

### 30s Flow diagram (draft)

```
Client / Agent                     Node / HUD
    | -- hello ------------------>     |
    | <-- hello ------------------     |
    | <-- orientation / snapshot ~     |
    | -- heartbeat ~~~~~~~>            |
    | <~ heartbeat ~~~~~~~             |
    | -- route_request ------------>   |
    | <-- route_response (branches)    |
    | <-- focus_snapshot (optional)    |
    | -- reconnect → hello ----------> |
```

## 🔰 LTP Dev Playground (Quickstart)

Spin up a local Rust LTP node, run HTTP/WS demos, and watch a live HUD in a few commands.

### 1. Install dependencies

```bash
pnpm install
# or
npm install
```

### 2. Run the Rust LTP node

```bash
cd nodes/ltp-rust-node
LTP_NODE_ADDR=127.0.0.1:7070 cargo run -p ltp-rust-node
```

The node listens on `ws://127.0.0.1:7070` by default and supports the core streams: `hello`, `heartbeat`, `orientation`, and `route_request/route_suggestion`.

### 3. Start demo clients

REST routing explanation (HTTP):

```bash
npm run demo-server       # default: http://localhost:4000
```

What it shows: an HTTP endpoint that accepts a request, computes temporal orientation and a routing preview, and responds with an explanation plus an ASCII future-weave graph.

WebSocket routing stream:

```bash
npm run ws-demo-server    # default: ws://localhost:4001/ws/orientation-demo
```

What it shows: a live stream with heartbeats, orientation updates, and routing previews over a persistent channel.

### 4. HUD / Monitor

```bash
npm run ltp:monitor       # console HUD for focus + mode
# or
npm run dev:gateway       # gateway-style view if you prefer a relay
```

What you’ll see: current mode (`calm / storm / shift`), volatility, focus momentum, and sparkline-style history for quick situational awareness.

### Demo commands

| Command                      | What it does                                      |
|------------------------------|---------------------------------------------------|
| `npm run demo-server`        | REST demo that explains routing decisions         |
| `npm run ws-demo-server`     | WebSocket demo (heartbeat + orientation + routing)|
| `npm run ltp:monitor`        | Console HUD showing focus/mode metrics            |
| `npm run dev:gateway`        | Gateway relay sample (connects node ↔ clients)    |
| `cargo run -p ltp-rust-node` | Starts the Rust LTP node (WebSocket endpoint)     |

## ✅ LTP Conformance (self-test)

![Conformance status](https://img.shields.io/badge/LTP%20Conformance-self--test-brightgreen)

We ship a deterministic conformance self-test with **three demo modes** to mirror the HUD: `calm`, `storm`, and `recovery`. The report always includes the conformance level and a `determinismHash` so you can verify the same sequence locally and in CI. Run `npm run conformance:report` to emit a stable JSON report at `artifacts/conformance-report.json` (CI uploads the same file as a workflow artifact on every push/PR).

**CLI (from the JS SDK workspace):**

```bash
pnpm --filter @liminal/ltp-client exec ltp-client self-test --mode calm
pnpm --filter @liminal/ltp-client exec ltp-client self-test --mode storm
pnpm --filter @liminal/ltp-client exec ltp-client self-test --mode recovery
```

**HTTP endpoint (served by `npm run demo:conformance:server`):**

```bash
curl "http://localhost:4000/conformance/self-test?mode=storm"
```

**WebSocket command (served by `npm run demo:conformance:ws`):**

```bash
node scripts/demo/conformanceWsClient.ts storm
# under the hood it sends
# { "type": "conformance_self_test", "v": "0.1", "payload": { "mode": "storm" } }
```

**CI artifact:** Download the `conformance-report` artifact from the `Test LTP SDKs` workflow run (Actions → `Test LTP SDKs` → latest run → **Artifacts**). It contains `artifacts/conformance-report.json` generated by `npm run conformance:report` using the `calm` self-test mode.

## ✅ LTP Conformance Kit (CLI)

One command to verify captures, emit deterministic reports, and publish a badge.

**Quickstart:**

```bash
pnpm -w install
pnpm -w ltp:conformance verify fixtures/conformance/v0.1/ok_basic_flow.json
pnpm -w ltp:conformance verify:dir fixtures/conformance/v0.1 --out reports/ci-report.json
pnpm -w ltp:conformance selftest --mode calm
```

Outputs:
- Machine-readable report at `reports/ltp-conformance-report.json` (override with `--out`).
- Badge-ready payload at `reports/ltp-conformance-badge.json` following [`specs/LTP-Conformance-Report-v0.1.md`](./specs/LTP-Conformance-Report-v0.1.md).

Example (text format):

```
ok_basic_flow.json -> OK score=1.000 errors=0 warnings=0 (report: reports/ltp-conformance-report.json)
```

Add your own fixtures under `fixtures/conformance/v0.1/` as `{ "frames": [...] }` JSON files; the `verify:dir` command picks them up in sorted order and aggregates results for CI.

To claim **“LTP-conformant (v0.1)”**, run the kit on your capture set and publish the resulting badge JSON with your docs or CI artifact stream.

## ✅ LTP Conformance Verifier (HTTP)

The demo HTTP server exposes a deterministic verifier for arbitrary frame captures at `POST /conformance/verify`. It evaluates the incoming sequence against the rules in [`specs/LTP-Conformance-Endpoint-v0.1.md`](./specs/LTP-Conformance-Endpoint-v0.1.md) (hello-first, version check, id uniqueness per sender, ordering, and tolerance for unknown frame types). Requests are constrained by a 512 KiB body limit and a 5,000-frame cap to discourage abusive payloads; deployers should pair it with a lightweight rate limiter for production use.

**Try it locally:**

```bash
npm run demo-server &

curl -X POST http://localhost:4000/conformance/verify \\
  -H "Content-Type: application/json" \\
  -d '{
        "frames": [
          { "v": "0.1", "id": "a", "ts": 1, "type": "hello", "payload": { "role": "client", "message": "hi" } },
          { "v": "0.1", "id": "b", "ts": 2, "type": "heartbeat", "payload": { "seq": 1 } },
          { "v": "0.1", "id": "c", "ts": 3, "type": "mystery", "payload": {} }
        ]
      }'
```

The response includes `{ ok, score, errors, warnings, passed, hints, annotations, frameCount }` and is fully deterministic for a given input.

Specs for reference: [LTP Conformance Endpoint v0.1](./specs/LTP-Conformance-Endpoint-v0.1.md) and [LTP Self-Test v0.1](./specs/LTP-SelfTest-v0.1.md).

📊 **For Investors & Experts:**
- [Investor Pitch](./INVESTOR_PITCH.md) - Executive summary, market opportunity, investment ask
- [Technical Whitepaper](./WHITEPAPER.md) - Deep technical analysis and research paper

### LTP Rust Node + JS demo client

1. Start the Rust LTP node (assumes WebSocket on `127.0.0.1:7070`):

```bash
LTP_NODE_ADDR=127.0.0.1:7070 cargo run -p ltp-rust-node
```

2. In another terminal, run the TypeScript dev client:

```bash
LTP_NODE_WS_URL=ws://127.0.0.1:7070 \
LTP_CLIENT_ID=demo-client-1 \
pnpm ts-node scripts/dev/ltp-node-demo.ts
```

You should see `hello/hello_ack`, periodic `heartbeat/heartbeat_ack`, orientation updates, and `route_suggestion` messages that react to the simulated time-focus shifts.

Example live console output (Dev Console v0.2):

```
=== LTP DEV CONSOLE v0.1 ===
[node] demo-node
[heartbeat] last ack: 1700000123

=== ORIENTATION WEB ===
focusMomentum: rising (0.73)
timeOrientation: future (0.80)

=== TIMEWEAVE ===
depthScore: 5 (multi-branch)
★ Deep weave – allow speculative routing

=== ROUTING ===
router.intent → sector: future_planning_high_momentum
reason: client oriented to future
★ Stable focus – normal routing
debug: {"focus_momentum":0.82,"time_orientation":{"direction":"future","strength":0.8}}
update: route_suggestion
```

### LTP Dev Console: severity & health-check + scenario mode

The Dev Console client now emits structured log events with severities and keeps a JSON snapshot of the current link/focus/routing state.

- **Severity levels:**
  - `info` — regular heartbeat/orientation/routing updates.
  - `warn` — soft alerts (e.g., drift detected, low focus momentum).
  - `critical` — stalled link or parse failures.
- **Link health (`linkHealth` in the snapshot):**
  - `ok` — heartbeat seen in the last 10s (link stable).
  - `warn` — no heartbeat for ~10–25s (drift or delay building up).
  - `critical` — silence for 25s+ (link at risk, reroute/reconnect).

#### Running the Dev Console in scenario mode (simulated OK → WARN → CRITICAL)

1. Start the Rust node (same as before):

```bash
LTP_NODE_ADDR=127.0.0.1:7070 cargo run -p ltp-rust-node
```

2. Launch the Dev Console with scenario mode enabled (no real traffic needed; it simulates heartbeat drift):

```bash
pnpm ts-node scripts/dev/ltp-node-demo.ts --scenario
```

Sample 6-line snapshot from the scenario run:

```
2025-12-10T12:00:00.000Z | INFO | [scenario] heartbeat steady-2 | link=ok | hb=2025-12-10T12:00:00.000Z | ori=present | route=sector.alpha
2025-12-10T12:00:11.000Z | WARN | link slowing (no heartbeat for 11s) | link=warn | hb=2025-12-10T12:00:00.000Z | ori=present | route=sector.alpha
2025-12-10T12:00:16.000Z | INFO | Snapshot summary | link=warn | hb=2025-12-10T12:00:00.000Z | ori=present | route=sector.alpha
2025-12-10T12:00:23.000Z | CRITICAL | [scenario] holding heartbeat to force critical state | link=warn | hb=2025-12-10T12:00:00.000Z | ori=present | route=sector.alpha
2025-12-10T12:00:26.000Z | CRITICAL | link critical (no heartbeat for 26s) | link=critical | hb=2025-12-10T12:00:00.000Z | ori=present | route=sector.alpha
2025-12-10T12:00:27.000Z | INFO | [scenario] scenario complete; shutting down | link=critical | hb=2025-12-10T12:00:00.000Z | ori=present | route=sector.alpha
```

In plain language: `ok` = link stable; `warn` = delays/drift are starting, watch the path; `critical` = link is in the danger zone — reroute, reconnect, or re-evaluate the node.

### Story-driven HUD demo (Phases A/B/C)

Run a single-client line-of-time demo that walks through calm focus, noisy context switching, and a soft landing while emitting routing previews and HUD lines:

```bash
npm run demo:story            # defaults to local scripted frames
DEMO_SPEED=800 npm run demo:story   # speed up playback (ms between frames)
USE_LOCAL_FRAMES=false npm run demo:story   # placeholder for a future live-gateway feed
```

### REST demo: routing explanation endpoint

Spin up a minimal HTTP server that exposes `/demo/explain-routing` for clients that want to inspect why LTP selected a given
routing branch and see the ASCII future weave graph:

```bash
npm run demo-server       # defaults to port 4000
PORT=5050 npm run demo-server
```

Example request with lightweight overrides:

```bash
curl "http://localhost:4000/demo/explain-routing?intent=deepen-focus&focusMomentum=0.72&volatility=0.18"
```

The response returns a formatted explanation, raw `RoutingExplainView`, metrics, and the ASCII weave graph so you can render or
analyze the chosen routing branch.

### WebSocket demo: live routing explanation stream
The WebSocket demo mirrors the REST endpoint and streams orientation decisions in real time.

```bash
npm run ws-demo-server            # defaults to port 4001
WS_PORT=5055 npm run ws-demo-server
```

Connect with any WebSocket client (for example, `wscat`):

```bash
wscat -c ws://localhost:4001/ws/orientation-demo
> { "type": "explain_demo" }
```

You will receive a JSON payload containing the decision summary, reasons, metrics, ASCII future weave graph, and the raw `RoutingExplainView` for further inspection.

Phases inside the scripted story:

- **Phase A – Focused work:** steady positive momentum, router leans to `deep_work`.
- **Phase B – Context switching / storm:** high volatility with sign flips; alternatives `social`, `rest`, `planning` surface.
- **Phase C – Recovery / soft landing:** volatility decays, momentum climbs back toward `light_work` or `planning`.

Example slice of the console output:

```
[PHASE=A | calm | vol=0.07 | momentum=0.82] → route: deep_work
   options: route: deep_work (conf=0.80) | alt: future_planning? (0.35)
   branches: stabilize (63%) → [deep_work → deep_work] || recover (19%) → [deep_work → rest] | explore (18%) → [deep_work → planning]
   phase: Phase A — Focused work | intents: deep_work, future_planning
[PHASE=B | storm | vol=0.46 | momentum=-0.06] → route: social
   options: route: social (conf=0.36) | alt: rest? (0.34), planning? (0.30)
   branches: soft-shift (55%) → [social → planning] || recover (27%) → [social → rest] | explore (18%) → [social → planning]
   phase: Phase B — Context switching / storm | intents: rest, social, planning
```

The demo now emits a **multi-path suggestion** per frame: one primary branch plus at least two alternatives (recover + explore).
It is a deterministic heuristic layered on top of the routing preview—no randomness or ML—so you can see how the protocol would
stabilize, re-anchor, or explore lighter sectors a few steps into the future.

### 🕸️ Future Weave Graph

A visual map of possible timelines inside L-THREAD / LTP.

Future Weave — это подсистема протокола LTP, которая строит и отображает множество возможных будущих траекторий, исходя из текущей ориентации (Temporal Orientation), фокуса, импульса и волатильности состояния.

Если коротко:
➡️ LTP больше не просто соединяет узлы. Он предсказывает, куда система может двигаться дальше.

🔍 Что такое Future Weave?

Вместо того чтобы давать только один маршрут (routing), система строит ветвящийся граф будущего:

- Primary Path — основная линия развития
- Recovery Path — путь стабилизации после перегрузки/дезориентации
- Explore Path — исследовательская траектория, предлагающая новые направления

Каждая ветка сопровождается метаданными:

- likelihood — вероятность
- momentum — инерция движения
- volatility — изменчивость состояния
- softenedSector — сглаженный сектор ориентации

Future Weave даёт протоколу способность двигаться не в одну точку, а в пространство вариантов.

🧩 Зачем это нужно?

Простые протоколы дают простой ответ:
➡️ «Иди туда».

LTP отвечает иначе:
➡️ «У тебя есть три линии движения. Вот их форма, глубина и вероятность. Выбери ту, которая соответствует твоему состоянию».

Это делает LTP пригодным для:

- адаптивных пользовательских интерфейсов
- интеллектуальных маршрутизаторов состояний
- эмоционально-чувствительных агентов
- обучающих систем, которые не давят инструкциями, а показывают варианты

Future Weave — это сердцевина LIMINAL-идеи: переходы важнее статического ответа.

📐 ASCII-Граф: живая схема будущих веток

Renderer превращает временные расчёты в понятную схему:

```
PRIMARY (p=0.63, m=0.42)
│
├─► [Next: 3] (vol=0.12)
│
└─ RECOVERY (p=0.27)
   ├─► [Next: 1] (vol=0.05)
   └─► [Next: 2] (vol=0.21)

EXPLORE (p=0.10, m=0.33)
└─► [Next: 4] (vol=0.30)
```

✔️ Детерминированный вывод
✔️ Сортировка веток по значимости
✔️ Включение/отключение показателей через флаги
✔️ Компактный человекочитаемый формат

🚀 Story Demo

Чтобы быстро увидеть работу Future Weave:

```bash
npm run demo:future-weave
```

Скрипт:

1. Считает temporal orientation
2. Строит multi-path вероятности
3. Визуализирует итоговый граф
4. Печатает компактные метаданные каждой ветки

Это идеальный инструмент для разработки и отладки.

🧪 Тесты

Future Weave покрыт тестами:

- корректность веток
- сортировка
- значения momentum/volatility
- стабильность вывода ASCII-графа

Запуск:

```bash
npm run test:future-weave-graph
```

🧠 Куда движется Future Weave дальше?

Следующие шаги:

1. JSON-экспорт графа (для UI, dashboards, HUD)
2. Web-рендерер (SVG версии графа)
3. Мультиагентные сценарии (через LTP-gateway)
4. Интеграция с Liminal OS и Sensor Bridge
5. «Черепаха времени» — управление перспективой просмотра будущих ветвей

### Dev Console Visual Health View

The Dev Console now renders a compact, colorized health line on every heartbeat or routing update. Run it with:

```bash
npm run dev:ltp-node-demo -- --verbose   # add --scenario to simulate OK → WARN → CRIT
```

- `[OK]` — green, link stable.
- `[WARN]` — yellow/orange, heartbeat drift building up.
- `[CRIT]` — red, link is stalling (reroute/reconnect).

Sample output (colors appear in the terminal):

```
[OK] hb=42ms jitter=6ms | routing=sector.alpha intent=STABLE | fm: ▂▄█▆█▅ (0.81)
[WARN] hb=410ms | routing=sector.beta intent=ADJUST | fm: ▂▃▂▁ (-0.22)
[CRIT] hb=? | fm=–
```

### What Makes LTP Different

Unlike traditional HTTPS/WebSocket protocols that treat data as isolated transactions, LTP maintains a continuous **liminal thread session** that:

- Preserves contextual continuity across all messages
- Carries metadata about user intent and inner state
- Enables resonant communication patterns between human and system
- Provides foundation for higher-level semantic protocols

### Architecture Position

LTP operates as a dedicated layer in the LIMINAL stack:

```
┌─────────────────────────────────────┐
│  LRI (Liminal Resonance Interface)  │  ← 8th Layer: Semantic/Intent
│         Application Layer           │
├─────────────────────────────────────┤
│    L-THREAD / LTP (this protocol)   │  ← Transport: Security + Context
├─────────────────────────────────────┤
│     WebSocket / TCP / QUIC          │  ← Standard Transport
└─────────────────────────────────────┘
```

**LTP Role:** Secure transport + context preservation
**LRI Role:** Semantic layer, resonance patterns, intent processing

### Semantic Layers: Thread Life Model → Consciousness Web

- **Thread Life Model** captures the lifecycle of a single thread (birth → active → weakening → switching → archived) with energy/resonance metadata. SDK reference: [`sdk/js/README.consciousness-web.md`](./sdk/js/README.consciousness-web.md).
- **Consciousness Web & Orientation Shell** build on top of that lifecycle to map relationships between threads (parent/child, shared scope/tags) and rotate focus across sectors. Specification: [`specs/LTP-ConsciousnessWeb.md`](./specs/LTP-ConsciousnessWeb.md).

## Key Features (v0.1)

- **Liminal Secure Handshake:** Protocol-level session establishment with future crypto hooks
- **Thread Session Model:** Unique `thread_id` + `session_id` tracking
- **Unified Message Envelope:** JSON-based format for all message types
- **Context Preservation:** Metadata fields for client state and trace tracking
- **Liminal Metadata:** Optional affect and context tags for semantic layers
- **Message Types:** `handshake`, `ping`, `state_update`, `event`

## LTP v0.2 Overview

- **Continuity of the thread:** Clients persist `thread_id` in local storage (browser `localStorage`, filesystem, etc.) and attempt `handshake_resume` before falling back to `handshake_init` so liminal state survives reconnects or app restarts.
- **Heartbeat & reconnect strategy:** SDKs send timed `ping` frames, expect `pong` within a configurable timeout, and automatically reconnect with exponential backoff (default: start at 1s, cap at 30s, stop after 5 tries) before surfacing a permanent failure hook.
- **Security skeleton:** Every envelope carries a unique `nonce` and a placeholder `signature`. Real crypto lands in v0.3+, but v0.2 now clearly documents that deployments MUST run over TLS/WSS and gives the hooks needed for experimental signing.

Lifecycle (storage + resume + heartbeat):

```
[connect()]
   |
   v
[storage has thread_id?] -- no --> [handshake_init] --> [store thread_id]
   |
  yes
   v
[handshake_resume] -- not found --> [handshake_init]
          |
        found
          v
[session established] -> [heartbeat loop] -> [reconnect on failure]
```

**Recommended environment:** Always use `wss://` (or HTTPS/TLS) endpoints until the upcoming signature/verification layer is finalized. Nonces plus TLS provide basic replay protection in the interim.

## LTP v0.3: TOON-aware Payloads

v0.3 introduces optional **TOON (Token-Oriented Object Notation)** support for compact payload encoding, especially useful for large arrays of similar objects (affect logs, event batches, telemetry).

### What is TOON?

TOON is a compact, table-like format designed to reduce token counts for LLM-centric workflows. It's particularly effective for:
- **Affect logs** — arrays of emotional state measurements
- **Event batches** — sequences of similar events
- **Telemetry data** — time-series measurements

**Benefits:**
- **30–60% token reduction** for large arrays
- **Better LLM prompt efficiency** — more data fits in context windows
- **Compact representation** — especially for table-like data

### How TOON Works in LTP

LTP itself doesn't parse TOON — it only carries the `content_encoding` flag. The actual encoding/decoding is handled by application-layer codecs (or dedicated TOON libraries).

**JSON payload (default):**
```json
{
  "type": "state_update",
  "thread_id": "abc",
  "content_encoding": "json",
  "payload": {
    "kind": "affect_log",
    "data": [
      { "t": 1, "valence": 0.2, "arousal": -0.1 },
      { "t": 2, "valence": 0.3, "arousal": -0.2 }
    ]
  }
}
```

**TOON payload (compact):**
```json
{
  "type": "state_update",
  "thread_id": "abc",
  "content_encoding": "toon",
  "payload": {
    "kind": "affect_log",
    "data": "rows[2]{t,valence,arousal}:\n  1,0.2,-0.1\n  2,0.3,-0.2\n"
  }
}
```

### Enabling TOON in SDK

**TypeScript/JavaScript:**

```typescript
import { LtpClient } from '@liminal/ltp-client';
import { simpleToonCodec } from './simpleToonCodec';

const client = new LtpClient('ws://localhost:8080', {
  clientId: 'example-js',
  codec: simpleToonCodec,           // TOON codec implementation
  preferredEncoding: 'toon',        // Use TOON when possible
});

// Send affect log - automatically encoded as TOON
client.sendStateUpdate({
  kind: 'affect_log_v1',
  data: [
    { t: 1, valence: 0.2, arousal: -0.1 },
    { t: 2, valence: 0.3, arousal: -0.2 },
    { t: 3, valence: 0.1, arousal: 0.0 }
  ]
});
```

**When TOON is used:**
- `preferredEncoding: 'toon'` is set
- A `codec` with `encodeJsonToToon` is provided
- Payload data is an array of similar objects

**When JSON is used (fallback):**
- `preferredEncoding` is `'json'` (default)
- No codec provided
- Payload is not an array or has mixed structure

### TOON Codec Implementation

LTP provides a **stub codec** (`simpleToonCodec`) for examples. For production:

- Use a proper TOON library (when available)
- Implement a full TOON codec per specification
- The stub codec is **NOT production-ready** — it's for demonstration only

See `specs/LTP-toon.md` for full TOON specification details.

## Liminal Metadata

LTP supports optional metadata fields designed for higher-level semantic protocols like LRI (Liminal Resonance Interface):

### Affect Metadata

Emotional state indicators for each message:

- **`valence`**: Emotional valence from -1 (negative) to 1 (positive)
- **`arousal`**: Arousal level from -1 (calm) to 1 (excited)

```typescript
{
  affect: {
    valence: 0.3,   // Slightly positive
    arousal: -0.2   // Slightly calm
  }
}
```

### Context Tags

String identifiers for the interaction context:

```typescript
context_tag: "focus_session"  // or "evening_reflection", "work_mode", etc.
```

### Usage in SDK

**Default metadata for all messages:**

```typescript
const client = new LtpClient('ws://localhost:8080', {
  clientId: 'my-device',
  defaultContextTag: 'dev_playground',
  defaultAffect: {
    valence: 0.0,
    arousal: 0.0
  }
});
```

**Per-message overrides:**

```typescript
// State update with explicit affect
client.sendStateUpdate(
  {
    kind: 'minimal',
    data: { focus_level: 0.8 }
  },
  {
    affect: { valence: 0.5, arousal: -0.3 }
  }
);

// Event with explicit context
client.sendEvent(
  'user_action',
  { action: 'started_session' },
  { contextTag: 'focus_session' }
);
```

**Important Notes:**

- These fields are **optional** and designed for future semantic layers
- LTP implementations **do not interpret** these values
- They provide hooks for LRI and other higher-level protocols
- Use them to enrich your application's contextual awareness

## Quick Start

### Prerequisites

- Node.js 18+ (for JavaScript SDK and examples)
- Python 3.9+ (for Python SDK)
- Elixir 1.14+ (for Elixir SDK and server)
- Rust 1.70+ (for Rust SDK and server)

### Run Minimal Example

**Option 1: JavaScript Server + Client**

1. **Start the server:**
   ```bash
   cd examples/js-minimal-server
   npm install && npm start
   ```

2. **In another terminal, run the client:**
   ```bash
   cd examples/js-minimal-client
   npm install && npm start
   ```

**Option 2: Elixir Server**

```bash
cd examples/elixir-server
mix deps.get
mix run --no-halt
```

**Option 3: Rust Server**

```bash
cd examples/rust-server
cargo run
```

You should see the handshake exchange, ping-pong messages, and state updates flowing through the liminal thread. All servers are compatible with all clients!

## Advanced Examples

For production-ready patterns and advanced use cases, see the **advanced examples** directory:

- **[JavaScript Advanced Examples](./examples/js-advanced/)** - Production client wrapper, event-driven architecture, metrics collection
- **[Python Advanced Examples](./examples/python-advanced/)** - Async worker pools, production client with structured logging
- **[Elixir Advanced Examples](./examples/elixir-advanced/)** - Supervised clients, GenServer patterns, batch operations
- **[Rust Advanced Examples](./examples/rust-advanced/)** - Concurrent operations, production client with metrics

These examples demonstrate:
- ✅ Production-ready error handling and reconnection
- ✅ Metrics collection and monitoring
- ✅ Batch operations with TOON encoding
- ✅ Event-driven architecture patterns
- ✅ Structured logging and observability
- ✅ Graceful shutdown and resource management

## Performance Benchmarks

Performance benchmarks are available to compare encoding strategies, throughput, and latency:

- **[Benchmarks Overview](./benchmarks/README.md)** - Complete benchmark documentation
- **JSON vs TOON** - Size reduction and encoding performance comparison
- **Throughput** - Message sending performance metrics

**Quick start:**
```bash
# JavaScript benchmarks
cd benchmarks/js
node json-vs-toon.js

# Python benchmarks
cd benchmarks/python
python json_vs_toon.py
```

See [benchmarks/README.md](./benchmarks/README.md) for detailed results and interpretation guidelines.

## SDK Ecosystem

LTP provides **multi-language SDK support** for seamless integration across different platforms and use cases:

| SDK | Version | Status | Best For |
|-----|---------|--------|----------|
| **JavaScript/TypeScript** | v0.3.0 | ✅ Production | Web browsers, Node.js apps |
| **Python** | v0.3.0 | ✅ Production | ML/AI pipelines, scripting |
| **Elixir** | v0.1.0 | ✅ Production | Real-time backends, high concurrency |
| **Rust** | v0.1.0 | ✅ Production | Edge computing, crypto, low-latency |

All SDKs are **100% protocol-compatible** and can communicate seamlessly. A client written in one language can connect to a server written in another, as long as both implement the LTP v0.3 specification.

📖 **See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed comparison, architecture overview, and deployment scenarios.**

## SDK Usage

### TypeScript/JavaScript

```typescript
import { LtpClient } from '@liminal/ltp-client';

const client = new LtpClient('ws://localhost:8080', {
  clientId: 'my-device-123'
});

await client.connect();

// Send state update
client.sendStateUpdate({
  kind: 'minimal',
  data: { mood: 'curious', focus: 'exploration' }
});

// Send event
client.sendEvent('user_action', {
  action: 'button_click',
  target: 'explore_mode'
});
```

### Python

```python
from ltp_client import LtpClient

client = LtpClient('ws://localhost:8080', client_id='my-device-123')
await client.connect()

# Send state update
await client.send_state_update({
    'kind': 'minimal',
    'data': {'mood': 'curious', 'focus': 'exploration'}
})

# Send event
await client.send_event('user_action', {
    'action': 'button_click',
    'target': 'explore_mode'
})
```

### Elixir

```elixir
{:ok, pid} = LTP.Client.start_link(%{
  url: "ws://localhost:8080",
  client_id: "elixir-example-1",
  default_context_tag: "evening_reflection"
})

:ok = LTP.Client.send_state_update(pid, %{
  kind: "affect_log_v1",
  data: [
    %{t: 1, valence: 0.2, arousal: -0.1},
    %{t: 2, valence: 0.3, arousal: -0.2}
  ]
})

:ok = LTP.Client.send_event(pid, "user_action", %{
  action: "button_click",
  target: "explore_mode"
})
```

### Rust

```rust
use ltp_client::LtpClient;
use serde_json::json;

let mut client = LtpClient::new("ws://localhost:8080", "rust-example-1")
    .with_default_context_tag("evening_reflection");

client.connect().await?;

client.send_state_update(
    "affect_log_v1",
    vec![
        json!({"t": 1, "valence": 0.2, "arousal": -0.1}),
        json!({"t": 2, "valence": 0.3, "arousal": -0.2}),
    ],
).await?;

client.send_event(
    "user_action",
    json!({"action": "button_click", "target": "explore_mode"}),
).await?;
```

## Example Scenario: Evening Reflection

LTP is designed to carry **semantic intent** (via LRI) through a **secure transport** layer. Here's a real-world example:

### The Scenario

> At the end of the day, a user opens their liminal client to reflect on their state. They note their energy, clarity, stress, and key highlights. This creates a "thread of the day" that flows into LIMINAL OS.

### The Message (LTP + LRI)

```json
{
  "type": "state_update",
  "thread_id": "4f3c9e2a-8b21-4c71-9d3f-1a9b12345678",
  "session_id": "b42a6f10-91a7-4ce2-8b7e-9d5f98765432",
  "timestamp": 1731700000,
  "meta": {
    "client_id": "android-liminal-001",
    "trace_id": "evt-2025-11-15-001",
    "affect": {
      "valence": 0.2,
      "arousal": -0.3
    },
    "context_tag": "evening_reflection"
  },
  "payload": {
    "kind": "lri_envelope_v1",
    "data": {
      "actor": "user:self",
      "intent": "reflect_on_day",
      "summary": "Slightly tired, but feeling a sense of quiet progress.",
      "highlights": [
        "played with kids",
        "advanced LTP protocol",
        "less anxiety about the future"
      ],
      "inner_state": {
        "energy": 0.4,
        "clarity": 0.7,
        "stress": 0.3
      },
      "resonance_hooks": [
        "family",
        "creator_path",
        "long_horizon"
      ]
    }
  }
}
```

### Layer Breakdown

**LTP (Transport/Meta):**
- `type`, `thread_id`, `session_id`, `timestamp` - routing and session
- `meta.client_id`, `meta.trace_id` - infrastructure metadata

**LRI (Semantic):**
- `meta.affect` - emotional state (valence/arousal)
- `meta.context_tag` - semantic context label
- `payload.data.*` - all semantic content (intent, state, resonance)

### Server Processing

When the server receives this message:

```
LTP[4f3c9e2a.../b42a6f10...] ctx=evening_reflection affect={0.2,-0.3} intent=reflect_on_day
```

The server can then:
1. **LTP layer** - Route message, maintain session context
2. **LRI layer** - Extract intent, match resonance hooks, update RINSE (Resonance INner State Engine)
3. **Response** - Send back resonance score and insights

See `specs/LTP-message-format.md` section 9 for full details.

## Repository Structure

```
.
├── README.md                    # This file
├── ARCHITECTURE.md              # Ecosystem architecture overview
├── DEPLOYMENT.md                # Deployment guide
├── API.md                       # API reference documentation
├── benchmarks/                  # Performance benchmarks
│   ├── js/                      # JavaScript benchmarks
│   └── python/                  # Python benchmarks
├── specs/
│   ├── LTP-core.md              # Core protocol architecture
│   ├── LTP-handshake.md         # Handshake protocol
│   ├── LTP-message-format.md   # Message envelope spec
│   └── LTP-toon.md             # TOON encoding specification
├── sdk/
│   ├── js/                      # TypeScript SDK
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── client.ts
│   │   │   └── index.ts
│   │   └── package.json
│   └── python/                  # Python SDK
│       └── ltp_client/
│           ├── __init__.py
│           ├── types.py
│           └── client.py
└── examples/
    ├── js-minimal-client/       # JavaScript client example
    ├── js-minimal-server/       # JavaScript server example
    ├── js-advanced/             # JavaScript advanced examples
    ├── python-advanced/         # Python advanced examples
    ├── elixir-server/           # Elixir server example
    ├── elixir-advanced/        # Elixir advanced examples
    ├── rust-server/             # Rust server example
    └── rust-advanced/          # Rust advanced examples
```

## Roadmap

### v0.1 (Current)
- [x] Basic protocol specification
- [x] JSON message envelope format
- [x] TypeScript and Python SDKs
- [x] Minimal client/server examples
- [ ] Basic documentation

### v0.3 (Current)
- [x] TOON payload encoding support
- [x] `content_encoding` field in message envelope
- [x] TOON codec interface and stub implementation
- [x] Automatic TOON encoding for arrays in JS SDK
- [x] TOON-aware logging in examples

### v0.4 (Planned)
- [ ] Real cryptographic handshake (key exchange, signatures)
- [ ] Enhanced inner state metadata schema
- [ ] Compression support (zstd)
- [ ] Binary message format option (CBOR, MessagePack)
- [ ] Rate limiting and flow control

### v0.3+ (Future)
- [ ] Multi-device thread synchronization
- [ ] Advanced resonance pattern matching
- [ ] LRI integration examples
- [ ] Production-grade error handling
- [ ] Performance benchmarks

## Concepts

### Liminal Thread

A **liminal thread** is a persistent communication channel that exists "between" traditional request-response cycles. It maintains continuity of context, allowing the system to understand not just *what* the user is doing, but the underlying flow of their interaction and intent.

### Inner State

User's current cognitive and emotional context - attention, focus, intent clarity, emotional resonance. LTP preserves hooks for this data without imposing specific schemas (v0.1 keeps this minimal).

### Resonance

The alignment between user intent and system response. LTP provides the transport; LRI (the layer above) interprets and acts on resonance patterns.

## Contributing

This protocol is in early development. Contributions, suggestions, and discussions are welcome.

## License

See LICENSE file for details.

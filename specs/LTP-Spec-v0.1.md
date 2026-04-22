# LTP (Liminal Thread Protocol) — Spec v0.1

> Draft / skeleton. This document captures the practical protocol profile used for deterministic oversight and replay inspection.

## 1. Overview

LTP is a protocol for deterministic replay and inspection of agent traces.

It is designed to:

- assess **admissibility** of execution paths,
- detect **drift** from anchored/grounded context,
- reject **unsupported claims or actions**, and
- emit **audit-grade evidence** for review, governance, and compliance workflows.

LTP is transport-agnostic (HTTP, WebSocket, etc.) and model-agnostic (framework/vendor independent).

## 2. Practical Protocol Model (v0.1)

### 2.1 Trace capture and replay

- Agent/system execution is captured as structured trace events (typically JSONL).
- Replay is deterministic: the same trace produces the same inspection result under the same rules.
- Replay output is intended for human and machine review.

### 2.2 Execution-path judgments

LTP classifies execution paths into:

- `admissible`: grounded, anchor-consistent, policy-safe path.
- `drift`: degraded or weakly grounded path requiring review.
- `rejected`: unsupported, ungrounded, or policy-invalid path.

These are oversight/control decisions on traceable execution paths, not only output-quality labels.

### 2.3 Two-phase enforcement profile

1. **Phase 1 (pre-execution / pre-generation):** block progression when required grounding/anchors are missing.
2. **Phase 2 (post-generation):** inspect generated outputs/actions and reject unsupported or fabricated claims.

Hallucination detection/prevention is included in scope as one failure class inside unsupported-path rejection.

## 3. Message Types (logical level)

### 3.1 `hello`

Purpose: handshake and exchange of basic info (`clientId`, version, capabilities).

### 3.2 `heartbeat`

Purpose: keep the channel alive; may include a lightweight status (`ok / warn / critical`).

### 3.3 `orientation`

Purpose: deliver current runtime orientation and associated metrics/anchors for clients that use orientation semantics.

### 3.4 `route_request` / `route_suggestion`

- `route_request`: input context (threadId, current point, goals/constraints).
- `route_suggestion`: output with chosen path and alternatives.

### 3.5 `focus_snapshot`

Snapshot of focus state and history window for HUDs and external clients.

## 4. Transports

- **HTTP**: e.g., `POST /ltp/route` → `route_suggestion` (`src/server/httpDemoServer.ts`).
- **WebSocket**: channel `ltp` with typed messages (`src/server/wsDemoServer.ts`, `nodes/ltp-rust-node`).

## 5. Reference Implementations

- JS SDK (`sdk/js`)
- Rust node (`nodes/ltp-rust-node`)
- Dev Playground demos (`scripts/dev`, `scripts/monitor`, `scripts/gateway`)

## 6. Status

Status: Draft, v0.1. Not stable; subject to change as the protocol is refined.

## 7. Replay Inspection Profile (CLI v0.1)

The reference CLI command is:

```bash
ltp inspect trace <trace.jsonl> --replay --phase two_phase --color
```

Decision semantics:

- `admissible`: anchored and policy-safe.
- `drift`: degraded context requiring review.
- `rejected`: missing anchor or unsupported claim/action.

## 8. Optional conceptual framing (legacy/experimental)

The following concepts exist in parts of the repository and may be useful for specific UX, visualization, or research discussions, but they are **not** the primary practical identity of the protocol:

- threads
- temporal orientation
- Future Weave / future branches
- Consciousness Web

For v0.1 operational usage, the primary framing is deterministic replay, execution-path admissibility, drift detection, unsupported-path rejection, and evidence export.

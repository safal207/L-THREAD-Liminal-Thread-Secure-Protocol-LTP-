# LTP (Liminal Thread Protocol) — Spec v0.1

> Draft / skeleton. This document captures the core concepts and message types of LTP.

## 1. Overview

LTP is a protocol for:
- tracking **threads** (meaningful lines of activity),
- maintaining **temporal orientation** (where we are in time / phase),
- exploring **future branches** (Future Weave),
- and exposing a **Consciousness Web** view over multiple threads.

It is transport-agnostic (can run over HTTP, WebSocket, etc.) and is designed to work both for humans and agents.

## 2. Core Concepts

### 2.1 Thread

- **ThreadId**: stable identifier of a line of activity.
- **ThreadState**: snapshot of where the thread is (sector, phase, depth).
- Key idea: a thread exists while attention/energy flows through it.

### 2.2 TimeWeave

- Stores the history of states/events for a thread/focus window.
- Surfaces metrics such as `focusMomentum`, `volatility`, and `depthScore`.
- Powers the computation of **temporal orientation** used by routers and HUDs.

### 2.3 Future Weave

- Represents possible future branches.
- Each branch carries a `label` (primary / recover / explore), a `likelihood`, and sector cues (softening / tension).
- References: `src/visualization/futureWeaveGraph.ts`, `src/routing/`.

### 2.4 Consciousness Web

- Aggregates multiple threads into a grid of `sectors`, `links`, and `intensity`.
- Provides a system-level view: current focus, overloaded sectors, and potential growth points.
- Reference: `sdk/js/src/consciousnessWeb.ts`.

## 3. Message Types (logical level)

### 3.1 `hello`

Purpose: handshake and exchange of basic info (`clientId`, version, capabilities).

### 3.2 `heartbeat`

Purpose: keep the channel alive; may include a lightweight status (`ok / warn / critical`).

### 3.3 `orientation`

Purpose: deliver current **temporal orientation** (sector such as calm / storm / transition), time metrics (momentum, volatility), and anchors.

### 3.4 `route_request` / `route_suggestion`

- `route_request`: input context (threadId, current point, goals/constraints).
- `route_suggestion`: output with the chosen path plus alternative branches (Future Weave) and reasoning based on metrics and signals.

### 3.5 `focus_snapshot`

Snapshot of focus state: history window, momentum, HUD-derived mode (`calm / storm / shift`), usable by HUDs and external clients.

## 4. Transports

- **HTTP**: e.g., `POST /ltp/route` → `route_suggestion` (`src/server/httpDemoServer.ts`).
- **WebSocket**: channel `ltp` with typed messages (`src/server/wsDemoServer.ts`, `nodes/ltp-rust-node`).

## 5. Reference Implementations

- JS SDK (`sdk/js`)
- Rust node (`nodes/ltp-rust-node`)
- Dev Playground demos (`scripts/dev`, `scripts/monitor`, `scripts/gateway`)

## 6. Status

Status: Draft, v0.1. Not stable; subject to change as we refine the protocol.

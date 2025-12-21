# LTP Canonical Flow v0.1 — Status: RC1 (additive-only)

**Status:** RC1 (normative intent, frozen at v0.1 for shape compatibility)  
**Change policy:** additive-only until v0.1 tag.  
**Depends on:** `specs/LTP-Frames-v0.1.md`, `specs/LTP-Flow-v0.1.md`, `specs/LTP-Conformance-v0.1.md`. See `specs/LTP-v0.1-RC1.md` for the RC checklist and CI gate.

## Status

This document is **NORMATIVE** for LTP Frozen Core v0.1.

All statements using RFC 2119 keywords (MUST, MUST NOT, SHOULD, MAY)
define compliance requirements.

Examples and diagrams are **INFORMATIVE** unless explicitly stated otherwise.

## Purpose
This document defines the **canonical, deterministic reference flow** for LTP v0.1.
Any compliant implementation (Rust node, Node gateway, JS SDK, HUD) **SHOULD**
be able to reproduce an equivalent sequence of frames for the same inputs.

Canonical flow is used for:
- cross-language conformance (Rust/Node/JS)
- stable demos and docs
- deterministic CI checks

## Frozen Core scope
Frozen Core v0.1 defines:
- orientation primitives
- transition semantics
- continuity invariants

It does NOT define:
- routing strategies
- scoring algorithms
- UI, visualization, or SDK behavior

## Normative rules
1. **Frame compatibility:** implementations MUST NOT break existing frame types.
2. **Determinism:** given the same input, output frames MUST be stable in:
   - `type`
   - required payload fields
   - ordering
3. **Transport-agnostic:** this flow MUST be representable over WebSocket and REST.
4. **Storage-agnostic:** no database is required to execute the flow.

## Session semantics
- **REST session:** the lifetime of a canonical session is the full HTTP request chain identified by a stable `Correlation-Id`
  (or equivalent trace header). Retries with the **same** correlation id MUST be treated as the **same session**; servers MUST
  return the same deterministic `route_response` payload to idempotent retried calls.
- **WebSocket session:** the lifetime of a canonical session is the WebSocket connection identified by its connection id.
  Reconnects with a **new** connection id start a **new** session; reconnect attempts that reuse a **previous connection id**
  MUST be rejected to avoid ambiguity.
- **Reconnect + duplicates:** if a client reconnects with a **new id**, the node MAY replay the last known `orientation` or
  `focus_snapshot` for continuity but MUST NOT re-emit `route_response` without a fresh `route_request`. Duplicate frame ids
  MUST be ignored while keeping the underlying session open.

## Continuity and orientation invariants
A compliant LTP implementation **MUST NOT** silently lose orientation state.
Silent orientation loss is considered a protocol violation, even if downstream behavior appears correct.

Orientation Loss:
A condition where identity, focus, or drift history is dropped, reset, or overwritten without an explicit transition event.

Example:
An LTP node MUST preserve orientation across retries.
An LTP node MAY update focus momentum during a transition.
An LTP node MUST NOT rewrite drift history retroactively.

## Canonical sequence (v0.1)
A canonical session is a sequence of frames exchanged between:
- **Client/Agent** (initiator)
- **Node** (router/orienter)
- **HUD** (optional observer)

### Step 0 — Connect
Transport connection is established (WS or HTTP session).

### Step 1 — hello (bidirectional)
Client sends:
- `hello` (role=client|agent, capabilities include `ws|routing|focus`)

Node replies:
- `hello` (role=node, capabilities include `routing|focus_snapshot|orientation`)

### Step 2 — heartbeat loop (optional but canonical-friendly)
Client MAY send `heartbeat` periodically.
Node MAY respond with its `heartbeat` (or omit response).

### Step 3 — orientation (node → client, optional but recommended)
Node MAY send `orientation` as soon as it can infer a stable posture.
If sent, it MUST include at least:
- `mode` in `{ calm, storm, shift }`
- `focus` as number in `[0..1]`

### Step 4 — route_request (client → node)
Client sends `route_request` with:
- `intent` (string)
- `constraints` (object) if present

### Step 5 — route_response (node → client)
Node returns `route_response` containing:
- `branches[]` with `id` and `confidence` in `[0..1]`

### Step 6 — focus_snapshot (node → hud|client, optional)
Node MAY emit `focus_snapshot` for HUD/self-diagnostics.
If emitted, it MUST include:
- `health` in `{ OK, WARN, CRITICAL }`
- optional extended metrics (e.g. `volatility`, `depth`, `tenderness`)

## Conformance v0.1 checklist — Status: Draft (stabilizing for v0.1 freeze)
**Applies to:** Frozen Core v0.1  
**Scope:** Protocol compliance (canonical flow + frame semantics), not product correctness or UX.

**Compliance levels**
- **MUST** — required for LTP protocol compliance  
- **MAY** — optional; must not alter core semantics  
Violation of any **MUST** condition is **non-compliant** (fail fast).

**Checklist**
- MUST: Complete Steps 1–5 successfully (`hello` → `route_response`).  
  → Defined in: `specs/LTP-Flow-v0.1.md` and `specs/LTP-Frames-v0.1.md`
- MUST: Preserve stable branch ordering for identical inputs.  
  → Defined in: `specs/LTP-Canonical-Flow-v0.1.md`
- MUST: Keep frame shapes compatible with v0.1 (`hello`, `heartbeat`, `orientation`, `route_request`, `route_response`).  
  → Defined in: `specs/LTP-Frames-v0.1.md`
- MAY: Emit `focus_snapshot` with required fields when present.  
  → Defined in: `specs/LTP-Frames-v0.1.md`

## Compliance verification
Implementations SHOULD provide a reproducible trace of orientation transitions.

Reference conformance tests are provided in `/conformance`.
A compliant implementation SHOULD pass all Frozen Core v0.1 checks.

## Non-goals
- No ML requirement
- No persistence requirement
- No “perfect prediction” requirement

Canonical flow defines **orientation + multiple futures**, not certainty.

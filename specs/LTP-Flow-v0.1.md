# LTP Flow v0.1 (Draft)

## Purpose
LTP Flow defines how **LTP Frames** move between participants to form a *living, orientable connection* (“thread”) across time.

Flow is intentionally minimal:
- No mandatory storage layer.
- No mandatory ML.
- Deterministic, explainable behavior.
- Additive evolution: new flow patterns MAY appear, existing ones MUST remain compatible.

This spec depends on:
- `specs/LTP-Frames-v0.1.md`

---

## Entities
- **Node**: a protocol participant that can route/reflect frames (Rust/Node).
- **Client**: an app/user agent producing frames and consuming routing/orientation.
- **Agent**: a specialized participant (reasoner, analyzer, orchestrator).
- **HUD**: visualization/monitoring interface.

---

## Flow concepts

### Flow vs Session
- **Flow**: a semantic stream of frames that can pause/resume and branch.
- **Session**: a transport-level connection (WS/HTTP). Sessions are optional carriers for Flow.

Flow MAY survive transport disconnects by continuing with new sessions.

### Silence is a signal
Absence of expected frames (e.g., heartbeat) is treated as meaningful input for routing/health.

### Branching is normal
Flow can produce multiple plausible futures; the protocol supports multi-branch suggestions instead of forcing a single path.

---

## Transport (v0.1)
LTP Flow MAY be transported via:
- WebSocket (preferred for real-time)
- HTTP (for request/response flows)

The framing is transport-agnostic: the **payload is always an LTPFrame**.

---

## Flow 1: Handshake (Hello Flow)

### Goal
Establish presence + role + minimal capabilities, without assuming storage or identity infra.

### Sequence (minimal)
1. `hello` from A → B
2. `hello` from B → A

### Sequence (recommended)
1. `hello`
2. `hello`
3. optional: `orientation`
4. optional: `focus_snapshot`

### Notes
- `capabilities` are informational; absence MUST NOT break interop.
- `from/to` MAY be used for addressing, but are optional in v0.1.

---

## Flow 2: Heartbeat (Rhythm Flow)

### Goal
Maintain a lightweight rhythm signal:
- liveness
- timing drift
- load hints

### Sequence
- Participant periodically emits `heartbeat`.

### Recommendations
- Heartbeat interval: 2–10 seconds (implementation-defined)
- `seq` MUST be monotonic per session (best-effort)
- `latency_ms` and `load` SHOULD be bounded to sane ranges

### Silence handling
If heartbeat is absent beyond a threshold:
- receiver MAY downgrade health, reduce depth, or request a snapshot.

---

## Flow 3: Orientation Updates (Orientation Flow)

### Goal
Provide semantic positioning of a line “right now”.

### Trigger conditions (non-normative)
`orientation` SHOULD be emitted when:
- `mode` changes (e.g., calm → shift → storm)
- focus crosses a threshold (e.g., 0.7 → 0.3)
- vector meaning changes (explore/stabilize/decide)

### Notes
- Orientation is not a command; it’s a descriptive state.
- Consumers SHOULD treat orientation as probabilistic guidance, not truth.

---

## Flow 4: Routing Guidance (Routing Flow)

### Goal
Given intent + constraints, produce multiple viable branches with confidences.

### Sequence
1. Client → Node: `route_request`
2. Node → Client: `route_response`

### Routing behavior (v0.1)
- `route_response.branches[]` MUST include at least 1 branch.
- `confidence` SHOULD be normalized in [0..1].
- Branch ordering SHOULD be descending by confidence.

### Principle
Routing MUST remain:
- deterministic for the same inputs (within one implementation version)
- explainable (even if explanation is a later optional frame)

### Optional extension (non-normative)
A Node MAY emit a `focus_snapshot` before/after `route_response` to help HUDs.

---

## Flow 5: Snapshot / HUD (Reflection Flow)

### Goal
Expose “how the line is doing” for:
- visualization
- self-diagnostics
- meta-reflection

### Sequence
- Any participant MAY emit `focus_snapshot`.

### Notes
- HUD consumption MUST be optional.
- Snapshots SHOULD not be used to control the client; they inform decisions elsewhere.

---

## Flow 6: Degradation / Load Safety (Homeostasis Flow)

### Goal
Prevent “thrashing” and noisy behavior.
When the system is overloaded, it should become gentler, not chaotic.

### Inputs that MAY trigger degradation
- `load` high (from heartbeat)
- volatility high (from snapshot or local metrics)
- drift indicates instability (if implemented)
- repeated routing requests with no convergence

### Expected behaviors (non-normative)
- lower depth preference
- reduce routing aggressiveness
- recommend grounding/stabilize branch
- slow down update frequency

---

## Flow 7: Resume & Continuity (Reconnect Flow)

### Goal
Allow flow continuity across transport reconnect.

### Minimal approach (v0.1)
- Reconnect uses `hello` again.
- Participant MAY emit `orientation` immediately after reconnect.
- Participant MAY emit `focus_snapshot` to resync HUD.

### Future compatibility
Later versions MAY add dedicated resume frames, but v0.1 keeps it simple.

---

## Compatibility rules
- New frame types MAY be added.
- Existing frame types MUST remain parseable.
- Unknown `type` MUST be safely ignored by receivers (best-effort).
- Flow patterns MUST degrade gracefully if a peer does not support them.

---

## Reference flows (cheat sheet)

### Minimal real-time client
`hello → hello → (heartbeat loop) → (orientation updates) → (route_request/route_response) → (focus_snapshot optional)`

### Minimal REST client
`route_request → route_response` (hello optional)

---

## Design principles (v0.1)
1. **Orientation over prediction**: describe where the line is, don’t hallucinate certainty.
2. **Multiple futures are normal**: prefer branching over single forced outputs.
3. **Silence is a signal**: absence matters.
4. **Homeostasis over force**: degrade gently under load.
5. **Additive evolution**: never break earlier flows.


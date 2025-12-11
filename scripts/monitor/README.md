# LTP Focus HUD

The Focus HUD is a console-first monitor for live L-THREAD telemetry. It connects to a running LTP node via the shared transport client and streams routing, latency, and focus momentum signals.

## Run

```bash
pnpm install
LTP_ENDPOINT=ws://localhost:8080/ws pnpm ltp:monitor
```

If no `LTP_ENDPOINT` is set, the HUD defaults to `ws://localhost:8080/ws`.

## Running HUD with real LTP server via Node gateway

```bash
pnpm install
LTP_UPSTREAM_WS=ws://127.0.0.1:8080/ws HUD_MONITOR_WS=ws://127.0.0.1:8090/focus pnpm dev:gateway
pnpm dev:focus-hud
```

1. Start the Rust LTP node and ensure it exposes a WebSocket endpoint.
2. Run the Node gateway to bridge `focus_snapshot` frames into the HUD monitor endpoint.
3. Launch the HUD (`pnpm dev:focus-hud` or `pnpm ltp:monitor`) to see live data instead of simulated pulses.

Manual integration check (flaky in CI): while the gateway is running, stop/start the upstream Rust node and confirm the HUD continues receiving snapshots after reconnects. Watch the gateway logs for the backoff sequence when the upstream goes offline.

### Focus snapshot payload

The HUD expects `focus_snapshot` messages shaped like:

```
{
  "type": "focus_snapshot",
  "timestamp": 1733822345234,
  "focusMomentum": 0.42,
  "orientationSummary": {
    "sector": "alpha",
    "intent": "GROWTH",
    "suggestedMode": "EXPAND"
  },
  "linkMeta": {
    "latencyMs": 41,
    "jitterMs": 3,
    "lossRate": 0
  }
}
```

Missing fields are tolerated; the HUD falls back to previously known values where possible.

## HUD display

The HUD now renders colorized modes and a compact sparkline of recent focus momentum:

```
[2024-11-28T08:42:12.392Z] mode=CALM | vol=0.042 | momentum=+0.351 | graph=▁▂▄▆█▆▅ | link=OK@41ms±3 | route=sector.alpha/GROWTH
```

### Routing preview HUD

Enable the routing preview compass for additional guidance about suggested sectors:

```bash
pnpm ltp:monitor -- --show-routing-preview
# or
LTP_SHOW_ROUTING_PREVIEW=true pnpm ltp:monitor
```

Example console block:

```
[ROUTING PREVIEW]
 now:     /home/focus/study
 next:    /home/focus/deep_work
 alt:     /home/rest/walk
 mood:    momentum=0.78, volatility=0.21
 reason:  stable focus, deepening current trajectory
 path: [STU]→[DEP]→[REST]
```

Set `NO_COLOR=1` to disable ANSI colors for terminals that do not support them.

## Example output

```
[CALM][OK] hb=39ms jitter=4ms | routing=sector.alpha intent=GROWTH | fm: ▁▂▄▆█▆▅ (+0.88)
[STORM][WARN] hb=210ms jitter=35ms | routing=sector.beta intent=ADJUST | fm: ▂▃▂▁ (-0.21)
[CALM][CRIT] hb=? | routing=? | fm=–
```

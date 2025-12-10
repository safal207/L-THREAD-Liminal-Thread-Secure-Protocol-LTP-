# LTP Focus HUD

The Focus HUD is a console-first monitor for live L-THREAD telemetry. It connects to a running LTP node via the shared transport client and streams routing, latency, and focus momentum signals.

## Run

```bash
pnpm install
LTP_ENDPOINT=ws://localhost:8080/ws pnpm ltp:monitor
```

If no `LTP_ENDPOINT` is set, the HUD defaults to `ws://localhost:8080/ws`.

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

## Example output

```
[CALM][OK] hb=39ms jitter=4ms | routing=sector.alpha intent=GROWTH | fm: ▁▂▄▆█▆▅ (+0.88)
[STORM][WARN] hb=210ms jitter=35ms | routing=sector.beta intent=ADJUST | fm: ▂▃▂▁ (-0.21)
[CALM][CRIT] hb=? | routing=? | fm=–
```

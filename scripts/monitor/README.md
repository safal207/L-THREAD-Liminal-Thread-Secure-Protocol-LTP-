# LTP Focus HUD

The Focus HUD is a console-first monitor for live L-THREAD telemetry. It connects to a running LTP node via the shared transport client and streams routing, latency, and focus momentum signals.

## Run

```bash
pnpm install
LTP_ENDPOINT=ws://localhost:8080/ltp pnpm ltp:monitor
```

If no `LTP_ENDPOINT` is set, the HUD defaults to `ws://localhost:8080/ltp`.

## Example output

```
[OK] hb=39ms jitter=4ms | routing=sector.alpha intent=GROWTH | fm: ▁▂▄▆█▆▅ (+0.88)
[WARN] hb=210ms jitter=35ms | routing=sector.beta intent=ADJUST | fm: ▂▃▂▁ (-0.21)
[CRIT] hb=? | routing=? | fm=–
```

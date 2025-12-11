# Turtle HUD v1

Minimal, tactical HUD that listens to the L-THREAD WebSocket demo server and visualises the current Turtle orientation:

- time direction: **past / now / future**
- social bias: **self / family / world**
- focus momentum: horizontal bar (0..1) mapped to low / medium / high
- TimeWeave depth: shallow / layered / deep + derived **mode hint** (explore / stabilize / commit)

The goal is to keep it as a cockpit instrument, not a fancy dashboard.

The HUD always renders a baseline state (connecting) and keeps the last meaningful snapshot visible if the connection drops or an error occurs.

## Files

```
examples/turtle-hud/
├─ index.html         # minimal HTML shell
├─ hudStyles.css      # dark, readable styling
├─ hud.ts             # TypeScript source (connects to WS, renders HUD)
├─ dist/hud.js        # browser-ready build of hud.ts
└─ README.md          # this file
```

## How to run

1. Install dependencies in the repo root (TypeScript + ws are already listed in `package.json`):

   ```bash
   npm install
   ```

2. Start the demo WebSocket server (ships with this repo):

   ```bash
   npm run ws-demo-server
   ```

   The HUD expects `ws://localhost:4001/ws/orientation-demo` by default. Override at runtime with `window.LTP_HUD_WS_URL` in DevTools if needed.

3. Build the HUD TypeScript into the `dist` folder:

   ```bash
   npx tsc examples/turtle-hud/hud.ts --target ES2020 --module ES2020 --lib DOM,ES2020 --outDir examples/turtle-hud/dist
   ```

4. Serve the folder (any static server works). From repo root you can run:

   ```bash
   npx http-server examples/turtle-hud -c-1
   ```

   Then open `http://localhost:8080` in your browser.

## What you will see

- **Turtle Orientation Compass** — highlights the current time direction (past / now / future) and shows the dominant social axis (self / family / world).
- **Focus Momentum bar** — fills proportionally to `focusMomentumScore`, labelled low / medium / high.
- **TimeWeave depth + Mode hint** — maps depth to shallow / layered / deep and derives a mode:
  - focus high & future → commit
  - depth high & family/world → explore
  - otherwise → stabilize
- **Meta hint** — optional text coming from the stream.

The HUD is tolerant to slightly different message shapes. It will try to read orientation fields directly, or fall back to `rawView`/`metrics`/`turtle` snapshots coming from the LTP demo stream.

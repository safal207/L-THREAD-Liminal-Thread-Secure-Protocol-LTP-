import {
  createLtpClient,
  LtpClient,
  LtpClientHandlers,
  TimeOrientationBoostPayload,
} from "../transport/ltpClient";
import { detectHudMode } from "./hudModes";
import { colorizeMode, HudMode, renderSparkline } from "./hudTheme";

export interface FocusHudSnapshot {
  linkHealth: "OK" | "WARN" | "CRIT";
  latencyMs?: number;
  jitterMs?: number;
  sector?: string;
  intent?: string;
  focusMomentum?: number;
}

export const FOCUS_HISTORY_LIMIT = 20;
const focusMomentumHistory: number[] = [];

function recordFocusMomentum(value?: number): void {
  if (value === undefined || Number.isNaN(value)) return;
  focusMomentumHistory.push(value);
  if (focusMomentumHistory.length > FOCUS_HISTORY_LIMIT) {
    focusMomentumHistory.shift();
  }
}

export function determineLinkHealth(latencyMs?: number, jitterMs?: number): "OK" | "WARN" | "CRIT" {
  if (latencyMs == null) return "CRIT";
  if (latencyMs < 80 && (jitterMs == null || jitterMs < 15)) return "OK";
  if (latencyMs < 200) return "WARN";
  return "CRIT";
}

function calculateVolatility(history: number[]): number {
  if (history.length < 2) return 0;
  const deltas = history.slice(1).map((value, index) => Math.abs(value - history[index]));
  const avgDelta = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
  return Number(avgDelta.toFixed(3));
}

export function renderFocusHudLine(
  snapshot: FocusHudSnapshot,
  fmHistory: number[],
  mode: HudMode = "calm",
): string {
  const { linkHealth, latencyMs, jitterMs, sector, intent, focusMomentum } = snapshot;
  const modeTag = mode === "storm" ? "STORM" : mode === "shift" ? "SHIFT" : "CALM";
  const timestamp = new Date().toISOString();

  const hbPart = latencyMs != null ? `${latencyMs}ms${jitterMs != null ? `±${jitterMs}` : ""}` : "?";
  const routingPart = `${sector ?? "?"}/${intent ?? "?"}`;
  const momentumPart =
    typeof focusMomentum === "number" && !Number.isNaN(focusMomentum)
      ? `${focusMomentum >= 0 ? "+" : ""}${focusMomentum.toFixed(3)}`
      : "?";
  const volatility = calculateVolatility(fmHistory).toFixed(3);
  const graph = renderSparkline(fmHistory) || "–";

  const modeSegment = colorizeMode(mode, `mode=${modeTag}`);

  return `[${timestamp}] ${modeSegment} | vol=${volatility} | momentum=${momentumPart} | graph=${graph} | link=${linkHealth}@${hbPart} | route=${routingPart}`;
}

function renderAndReport(snapshot: FocusHudSnapshot) {
  const mode = detectHudMode({
    focusHistory: focusMomentumHistory,
    linkHealth: snapshot.linkHealth,
    lastIntent: snapshot.intent,
    lastSector: snapshot.sector,
  });

  console.log(renderFocusHudLine(snapshot, focusMomentumHistory, mode));
}

function extractIntentFromOrientation(timeOrientation?: TimeOrientationBoostPayload): string | undefined {
  return timeOrientation?.direction
    ? `${timeOrientation.direction}${timeOrientation.strength !== undefined ? `@${timeOrientation.strength}` : ""}`
    : undefined;
}

function simulateFocusMomentum(now = Date.now()): number {
  const wave = Math.sin(now / 5000) * 0.8;
  const drift = Math.cos(now / 12000) * 0.15;
  return Number((wave + drift).toFixed(2));
}

function startFocusHud(): LtpClient {
  const endpoint = process.env.LTP_ENDPOINT ?? "ws://localhost:8080/ws";
  const clientId = process.env.LTP_MONITOR_CLIENT_ID ?? "ltp-focus-hud";

  const snapshot: FocusHudSnapshot = {
    linkHealth: "CRIT",
  };

  let lastFocusUpdateMs = 0;

  const handlers: LtpClientHandlers = {
    onConnected: () => {
      console.log(`[connect] Focus HUD connected to ${endpoint} as ${clientId}`);
    },
    onHelloAck: (message) => {
      if (message.accepted) {
        console.log(`[hello] accepted by node ${message.node_id}`);
      } else {
        console.warn(`[hello] rejected by node ${message.node_id ?? "?"}`);
      }
    },
    onHeartbeatAck: (_message, metrics) => {
      snapshot.latencyMs = Math.round(metrics.latencyMs);
      snapshot.jitterMs = metrics.jitterMs != null ? Math.round(metrics.jitterMs) : undefined;
      snapshot.linkHealth = determineLinkHealth(snapshot.latencyMs, snapshot.jitterMs);
      renderAndReport(snapshot);
    },
    onOrientation: (message) => {
      snapshot.focusMomentum = message.focus_momentum ?? snapshot.focusMomentum;
      recordFocusMomentum(snapshot.focusMomentum);
      snapshot.intent = message.time_orientation
        ? extractIntentFromOrientation(message.time_orientation)
        : snapshot.intent;
      lastFocusUpdateMs = Date.now();
      renderAndReport(snapshot);
    },
    onFocusSnapshot: (message) => {
      snapshot.focusMomentum = message.focusMomentum ?? snapshot.focusMomentum;
      recordFocusMomentum(snapshot.focusMomentum);

      snapshot.sector = message.orientationSummary?.sector ?? snapshot.sector;
      snapshot.intent = message.orientationSummary?.intent ?? snapshot.intent;

      const latency = message.linkMeta?.latencyMs ?? snapshot.latencyMs;
      const jitter = message.linkMeta?.jitterMs ?? snapshot.jitterMs;
      snapshot.latencyMs = latency != null ? Math.round(latency) : undefined;
      snapshot.jitterMs = jitter != null ? Math.round(jitter) : undefined;
      snapshot.linkHealth = determineLinkHealth(snapshot.latencyMs, snapshot.jitterMs);

      lastFocusUpdateMs = Date.now();
      renderAndReport(snapshot);
    },
    onRouteSuggestion: (message) => {
      snapshot.sector = message.suggested_sector ?? snapshot.sector;
      snapshot.intent = message.reason ?? snapshot.intent;
      const fm = message.debug?.focus_momentum;
      if (fm !== undefined) {
        snapshot.focusMomentum = fm;
        recordFocusMomentum(fm);
        lastFocusUpdateMs = Date.now();
      }
      if (!snapshot.intent && message.debug?.time_orientation) {
        snapshot.intent = extractIntentFromOrientation(message.debug.time_orientation);
      }
      renderAndReport(snapshot);
    },
    onError: (message, raw) => {
      console.warn(`[error] ${message.message}`, raw);
    },
    onClose: () => {
      console.warn("[ws] connection closed");
    },
  };

  const client = createLtpClient(endpoint, handlers, {
    clientId,
    sessionTag: "focus-hud",
    heartbeatIntervalMs: 5000,
  });

  setInterval(() => {
    const now = Date.now();
    if (now - lastFocusUpdateMs > 10_000) {
      const simulated = simulateFocusMomentum(now);
      snapshot.focusMomentum = simulated;
      recordFocusMomentum(simulated);
      renderAndReport(snapshot);
    }
  }, 4000);

  client.connect();
  return client;
}

if (require.main === module) {
  // TODO: wire real focusMomentum when the transport exposes it directly
  startFocusHud();
}

export { FOCUS_HISTORY_LIMIT, startFocusHud };

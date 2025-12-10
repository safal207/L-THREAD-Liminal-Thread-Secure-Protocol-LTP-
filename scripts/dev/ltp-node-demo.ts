import WebSocket from "ws";
import { renderMomentumSparkline } from "../shared/focusSparkline";
import { colorByHealth, formatHealthTag, LinkHealth } from "./utils/consoleColors";

// Shared protocol types mirrored from nodes/ltp-rust-node/src/protocol.rs
export type TimeOrientationDirectionPayload = "past" | "present" | "future" | "multi";

export interface TimeOrientationBoostPayload {
  direction: TimeOrientationDirectionPayload;
  strength: number; // 0..1
}

export type LtpIncomingMessage =
  | {
      type: "hello";
      client_id: string;
      session_tag?: string;
    }
  | {
      type: "heartbeat";
      client_id: string;
      timestamp_ms: number;
    }
  | {
      type: "orientation";
      client_id: string;
      focus_momentum?: number;
      time_orientation?: TimeOrientationBoostPayload;
    }
  | {
      type: "route_request";
      client_id: string;
      hint_sector?: string;
    };

type RouteSuggestionDebug = {
  focus_momentum?: number;
  time_orientation?: TimeOrientationBoostPayload;
};

export type LtpOutgoingMessage =
  | {
      type: "hello_ack";
      node_id: string;
      accepted: boolean;
    }
  | {
      type: "heartbeat_ack";
      client_id: string;
      timestamp_ms: number;
    }
  | {
      type: "route_suggestion";
      client_id: string;
      suggested_sector: string;
      reason?: string;
      debug?: RouteSuggestionDebug;
    }
  | {
      type: "error";
      message: string;
    };

type LogSeverity = "info" | "warn" | "critical";

interface DevConsoleEvent {
  severity: LogSeverity;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string; // ISO
}

interface DevConsoleSnapshot {
  lastHeartbeatAt?: string;
  heartbeat?: {
    latencyMs?: number;
    jitterMs?: number;
  };
  lastOrientationSummary?: {
    sectors?: string[];
    direction?: TimeOrientationDirectionPayload;
    strength?: number;
  };
  timeWeave?: {
    depthScore?: number;
    meta?: unknown;
  };
  focusMomentum?: {
    value?: number;
    trend?: "rising" | "falling" | "stable" | "unknown";
  };
  routing?: {
    intent?: string;
    suggestedSector?: string;
    reason?: string;
    debug?: RouteSuggestionDebug;
  };
  linkHealth?: LinkHealth;
}

const NODE_ADDR = process.env.LTP_NODE_WS_URL ?? "ws://127.0.0.1:7070";
const CLIENT_ID = process.env.LTP_CLIENT_ID ?? "demo-client-1";
const ARGS = process.argv.slice(2);
const SCENARIO_MODE = process.env.SCENARIO_MODE === "1" || ARGS.includes("--scenario");
const VERBOSE = ARGS.includes("--verbose") || ARGS.includes("-v");

const FOCUS_HISTORY_LIMIT = 16;
const focusMomentumHistory: number[] = [];

const HEALTH_CHECK_INTERVAL_MS = 5000;
const HEALTH_OK_THRESHOLD_MS = 10_000;
const HEALTH_WARN_THRESHOLD_MS = 25_000;

let ws: WebSocket | undefined;

let heartbeatInterval: NodeJS.Timeout | undefined;
let orientationInterval: NodeJS.Timeout | undefined;
let routeInterval: NodeJS.Timeout | undefined;
let healthCheckInterval: NodeJS.Timeout | undefined;

function summarizeConsoleState(): string {
  const summaryParts: Array<string | undefined> = [
    `link=${devState.snapshot.linkHealth ?? "unknown"}`,
    devState.snapshot.lastHeartbeatAt
      ? `hb=${devState.snapshot.lastHeartbeatAt}`
      : undefined,
    devState.snapshot.lastOrientationSummary?.direction
      ? `ori=${devState.snapshot.lastOrientationSummary.direction}`
      : undefined,
    devState.snapshot.routing?.suggestedSector
      ? `route=${devState.snapshot.routing.suggestedSector}`
      : undefined,
  ];

  return summaryParts.filter(Boolean).join(" | ");
}

function logEvent(
  severity: LogSeverity,
  message: string,
  details?: Record<string, unknown>,
): DevConsoleEvent {
  const event: DevConsoleEvent = {
    severity,
    message,
    details,
    timestamp: new Date().toISOString(),
  };

  const detailText = (() => {
    if (!details || Object.keys(details).length === 0) return "";
    if (VERBOSE) {
      return `\n       ${JSON.stringify(details, null, 2).replace(/\n/g, "\n       ")}`;
    }
    return ` | details: ${Object.keys(details).join(", ")}`;
  })();

  const humanSummary = summarizeConsoleState();
  const formattedLine = `${event.timestamp} | ${event.severity.toUpperCase()} | ${event.message}`;
  const formattedWithState = humanSummary ? `${formattedLine} | ${humanSummary}` : formattedLine;

  console.log(`${formattedWithState}${detailText}`);

  return event;
}

function logInfo(message: string, details?: Record<string, unknown>): void {
  logEvent("info", message, details);
}

function logWarn(message: string, details?: Record<string, unknown>): void {
  logEvent("warn", message, details);
}

function logCritical(message: string, details?: Record<string, unknown>): void {
  logEvent("critical", message, details);
}

type DevConsoleState = {
  connected: boolean;
  nodeId?: string;
  lastHeartbeatAck?: number;
  snapshot: DevConsoleSnapshot;
  routeDebug?: RouteSuggestionDebug;
};

const devState: DevConsoleState = {
  connected: false,
  snapshot: {
    linkHealth: "critical",
  },
};

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

export { renderMomentumSparkline } from "../shared/focusSparkline";

function recordFocusMomentum(value: number | undefined): void {
  if (value === undefined || Number.isNaN(value)) return;
  focusMomentumHistory.push(value);
  if (focusMomentumHistory.length > FOCUS_HISTORY_LIMIT) {
    focusMomentumHistory.shift();
  }
}

export function renderDevSnapshot(
  snapshot: DevConsoleSnapshot,
  options?: { verbose?: boolean },
): void {
  const latencyText = snapshot.heartbeat?.latencyMs !== undefined
    ? `${Math.round(snapshot.heartbeat.latencyMs)}ms`
    : "?";
  const jitterText = snapshot.heartbeat?.jitterMs !== undefined
    ? `${Math.round(snapshot.heartbeat.jitterMs)}ms`
    : undefined;
  const routingSegment = [
    snapshot.routing?.suggestedSector ? `routing=${snapshot.routing.suggestedSector}` : undefined,
    snapshot.routing?.intent ? `intent=${snapshot.routing.intent}` : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  const focusMomentum = snapshot.focusMomentum?.value;

  const sections: string[] = [
    `${formatHealthTag(snapshot.linkHealth)}`,
    `hb=${latencyText}`,
  ];

  if (jitterText) {
    sections.push(`jitter=${jitterText}`);
  }

  if (routingSegment) {
    sections.push(`| ${routingSegment}`);
  }

  if (focusMomentum !== undefined) {
    const spark = renderMomentumSparkline(focusMomentumHistory);
    const sparkPart = spark ? ` ${spark}` : "";
    sections.push(`| fm:${sparkPart} (${formatSigned(focusMomentum)})`);
  } else {
    sections.push(`| fm=–`);
  }

  const line = sections.join(" ").replace(/\s+/g, " ").trim();
  const coloredLine = colorByHealth(snapshot.linkHealth, line);
  console.log(coloredLine);

  if (options?.verbose) {
    console.log(JSON.stringify(snapshot, null, 2));
  }
}

const orientationPhases: Array<{
  focus_momentum: number;
  time_orientation: TimeOrientationBoostPayload;
}> = [
  {
    focus_momentum: 0.4,
    time_orientation: { direction: "present", strength: 0.5 },
  },
  {
    focus_momentum: 0.8,
    time_orientation: { direction: "future", strength: 0.8 },
  },
  {
    focus_momentum: 0.3,
    time_orientation: { direction: "past", strength: 0.7 },
  },
];

let orientationIndex = 0;

function sendMessage(msg: LtpIncomingMessage) {
  logInfo("send", { payload: msg });
  if (!ws) {
    logWarn("websocket not initialized; skipping send", { type: msg.type });
    return;
  }
  ws.send(JSON.stringify(msg));
}

function startHeartbeatLoop() {
  heartbeatInterval = setInterval(() => {
    sendMessage({
      type: "heartbeat",
      client_id: CLIENT_ID,
      timestamp_ms: Date.now(),
    });
  }, 5000);
}

function sendOrientationAndRoute() {
  const phase = orientationPhases[orientationIndex % orientationPhases.length];
  orientationIndex += 1;

  sendMessage({
    type: "orientation",
    client_id: CLIENT_ID,
    focus_momentum: phase.focus_momentum,
    time_orientation: phase.time_orientation,
  });

  updateOrientationSnapshot(phase.focus_momentum, phase.time_orientation);

  sendMessage({
    type: "route_request",
    client_id: CLIENT_ID,
    hint_sector: devState.snapshot.routing?.suggestedSector,
  });

  logSnapshot("orientation+route dispatched");
}

function startOrientationLoop() {
  // Kick off immediately, then repeat on interval
  sendOrientationAndRoute();
  orientationInterval = setInterval(() => {
    sendOrientationAndRoute();
  }, 12000);
}

function startRouteLoopFallback() {
  routeInterval = setInterval(() => {
    sendMessage({
      type: "route_request",
      client_id: CLIENT_ID,
      hint_sector: devState.snapshot.routing?.suggestedSector,
    });
  }, 25000);
}

function computeDepthScore(
  focusMomentum?: number,
  orientation?: TimeOrientationBoostPayload,
): number {
  const fm = focusMomentum ?? 0;
  const strength = orientation?.strength ?? 0;
  const blend = fm * 4 + strength * 3;
  return Math.min(5, Math.max(0, Math.round(blend)));
}

function computeFocusTrend(focusMomentum?: number): "rising" | "falling" | "stable" | "unknown" {
  if (focusMomentum === undefined) return "unknown";
  if (focusMomentum >= 0.75) return "rising";
  if (focusMomentum >= 0.45) return "stable";
  return "falling";
}

function describeDepth(depthScore?: number): string {
  if (depthScore === undefined) return "n/a";
  if (depthScore >= 4) return `${depthScore} (multi-branch)`;
  if (depthScore >= 2) return `${depthScore} (stable)`;
  return `${depthScore} (shallow)`;
}

function updateOrientationSnapshot(
  focusMomentum?: number,
  timeOrientation?: TimeOrientationBoostPayload,
) {
  const trend = computeFocusTrend(focusMomentum);
  const depthScore = computeDepthScore(focusMomentum, timeOrientation);

  recordFocusMomentum(focusMomentum);

  devState.snapshot.focusMomentum = {
    value: focusMomentum,
    trend,
  };
  devState.snapshot.lastOrientationSummary = {
    sectors: undefined,
    direction: timeOrientation?.direction,
    strength: timeOrientation?.strength,
  };
  devState.snapshot.timeWeave = {
    depthScore,
  };
}

function updateRoutingSnapshot(suggestedSector: string, reason?: string, debug?: RouteSuggestionDebug) {
  devState.snapshot.routing = {
    suggestedSector,
    intent: devState.snapshot.routing?.intent ?? "router.intent",
    reason,
    debug,
  };
  devState.routeDebug = debug;

  if (debug?.focus_momentum !== undefined) {
    recordFocusMomentum(debug.focus_momentum);
  }
}

function recordHeartbeat(timestampMs: number) {
  const now = Date.now();
  const latencyMs = Math.max(0, now - timestampMs);
  const previousLatency = devState.snapshot.heartbeat?.latencyMs;
  const jitterMs = previousLatency !== undefined ? Math.abs(latencyMs - previousLatency) : undefined;

  devState.lastHeartbeatAck = timestampMs;
  devState.snapshot.lastHeartbeatAt = new Date(timestampMs).toISOString();
  devState.snapshot.heartbeat = { latencyMs, jitterMs };
  devState.snapshot.linkHealth = "ok";
}

export function determineLinkHealth(
  lastHeartbeatAt?: string,
  nowMs: number = Date.now(),
): DevConsoleSnapshot["linkHealth"] {
  if (!lastHeartbeatAt) return "critical";

  const elapsedMs = nowMs - Date.parse(lastHeartbeatAt);

  if (elapsedMs < HEALTH_OK_THRESHOLD_MS) {
    return "ok";
  }
  if (elapsedMs < HEALTH_WARN_THRESHOLD_MS) {
    return "warn";
  }
  return "critical";
}

function evaluateLinkHealth(nowMs: number = Date.now()) {
  const nextHealth = determineLinkHealth(devState.snapshot.lastHeartbeatAt, nowMs);

  if (nextHealth === devState.snapshot.linkHealth) {
    return;
  }

  const lastHeartbeat = devState.snapshot.lastHeartbeatAt
    ? Date.parse(devState.snapshot.lastHeartbeatAt)
    : undefined;
  const elapsedMs = lastHeartbeat ? nowMs - lastHeartbeat : Infinity;

  devState.snapshot.linkHealth = nextHealth;

  const seconds = Math.round(elapsedMs / 1000);
  const healthTag = formatHealthTag(nextHealth);
  if (nextHealth === "ok") {
    logInfo(`${healthTag} link health OK (last heartbeat ${seconds}s ago)`, {
      lastHeartbeatAt: devState.snapshot.lastHeartbeatAt,
    });
  } else if (nextHealth === "warn") {
    logWarn(`${healthTag} link slowing (no heartbeat for ${seconds}s)`, {
      lastHeartbeatAt: devState.snapshot.lastHeartbeatAt,
    });
  } else {
    logCritical(`${healthTag} link critical (no heartbeat for ${seconds}s)`, {
      lastHeartbeatAt: devState.snapshot.lastHeartbeatAt,
    });
  }
}

function startHealthMonitor() {
  evaluateLinkHealth();
  healthCheckInterval = setInterval(() => {
    evaluateLinkHealth();
  }, HEALTH_CHECK_INTERVAL_MS);
}

function logSnapshot(reason?: string) {
  console.log("\n=== LTP DEV SNAPSHOT ===");
  renderDevSnapshot(devState.snapshot, { verbose: VERBOSE });

  if (VERBOSE) {
    const summary = {
      linkHealth: devState.snapshot.linkHealth,
      heartbeat: devState.snapshot.lastHeartbeatAt,
      focusMomentum: devState.snapshot.focusMomentum,
      routing: devState.snapshot.routing,
      depthScore: devState.snapshot.timeWeave?.depthScore,
      reason,
    };

    logInfo("Snapshot summary", summary);
  }
}

function renderDevConsole(reason: string, logState = false) {
  console.log("\n=== LTP DEV CONSOLE v0.3 ===");
  renderDevSnapshot(devState.snapshot, { verbose: VERBOSE });

  if (VERBOSE) {
    const orientationText = devState.snapshot.lastOrientationSummary
      ? `${devState.snapshot.lastOrientationSummary.direction ?? ""} (${(devState.snapshot.lastOrientationSummary.strength ?? 0).toFixed(2)})`
      : "n/a";
    const depthText = describeDepth(devState.snapshot.timeWeave?.depthScore);
    const focusValue = devState.snapshot.focusMomentum?.value;
    const focusText = devState.snapshot.focusMomentum?.trend
      ? `${devState.snapshot.focusMomentum.trend} (${focusValue?.toFixed(2) ?? "n/a"})`
      : "unknown";
    const nodeText = devState.connected ? devState.nodeId ?? "(node)" : "disconnected";
    const routerIntent = devState.snapshot.routing?.suggestedSector ?? "awaiting suggestion";

    console.log(`node: ${nodeText}`);
    console.log(`[heartbeat] last ack: ${devState.lastHeartbeatAck ?? "n/a"}`);
    console.log(`[link] health: ${devState.snapshot.linkHealth ?? "unknown"}`);

    console.log("\n=== ORIENTATION WEB ===");
    console.log(`focusMomentum: ${focusText}`);
    console.log(`timeOrientation: ${orientationText}`);

    console.log("\n=== TIMEWEAVE ===");
    console.log(`depthScore: ${depthText}`);
    if (devState.snapshot.timeWeave?.depthScore !== undefined && devState.snapshot.timeWeave.depthScore >= 4) {
      logInfo("Deep weave – allow speculative routing", { depthScore: devState.snapshot.timeWeave.depthScore });
    }

    console.log("\n=== ROUTING ===");
    console.log(`router.intent → sector: ${routerIntent}`);
    if (devState.snapshot.routing?.reason) {
      console.log(`reason: ${devState.snapshot.routing.reason}`);
    }
    if (focusValue !== undefined && focusValue < 0.45) {
      logWarn("Low focus momentum – suggest soft routing", {
        focusMomentum: focusValue,
        trend: devState.snapshot.focusMomentum?.trend,
      });
    } else {
      console.log("★ Stable focus – normal routing");
    }
    console.log(`debug: ${JSON.stringify(devState.snapshot.routing?.debug ?? {}, null, 2)}`);
    console.log(`update: ${reason}`);
  } else {
    console.log(`update: ${reason}`);
  }

  if (logState && VERBOSE) {
    logSnapshot(reason);
  }
}

function stopLoops() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  if (orientationInterval) {
    clearInterval(orientationInterval);
  }
  if (routeInterval) {
    clearInterval(routeInterval);
  }
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
}

function startRealtimeClient() {
  console.log(`Connecting to ${NODE_ADDR} as ${CLIENT_ID}...`);
  ws = new WebSocket(NODE_ADDR);

  ws.on("open", () => {
    logInfo("[ws] connected");
    sendMessage({
      type: "hello",
      client_id: CLIENT_ID,
      session_tag: "dev-demo",
    });
    logSnapshot("startup");
  });

  ws.on("message", (data) => {
    try {
      const parsed = JSON.parse(data.toString()) as LtpOutgoingMessage;
      logInfo("recv", { payload: parsed });

      if (parsed.type === "error") {
        logWarn("node error", { message: parsed.message });
        return;
      }

      if (parsed.type === "hello_ack") {
        if (parsed.accepted) {
          logInfo(`[hello] accepted by node ${parsed.node_id}`);
          devState.connected = true;
          devState.nodeId = parsed.node_id;
          renderDevConsole("hello accepted", true);
          startHeartbeatLoop();
          startOrientationLoop();
          startRouteLoopFallback();
          startHealthMonitor();
        } else {
          logCritical("[hello] rejected by node");
          ws?.close();
        }
        return;
      }

      if (parsed.type === "heartbeat_ack") {
        recordHeartbeat(parsed.timestamp_ms);
        evaluateLinkHealth();
        const healthTag = formatHealthTag(devState.snapshot.linkHealth);
        logInfo(`${healthTag} [heartbeat] ack for ${parsed.client_id}`, {
          at: devState.snapshot.lastHeartbeatAt,
        });
        renderDevConsole("heartbeat_ack");
        return;
      }

      if (parsed.type === "route_suggestion") {
        const debug = parsed.debug ?? {};
        const orientation = debug.time_orientation
          ? `${debug.time_orientation.direction}(${debug.time_orientation.strength})`
          : "n/a";
        const focus = debug.focus_momentum ?? "n/a";
        logInfo("route_suggestion", {
          sector: parsed.suggested_sector,
          reason: parsed.reason ?? "n/a",
          focusMomentum: focus,
          orientation,
        });

        updateRoutingSnapshot(parsed.suggested_sector, parsed.reason, debug);
        renderDevConsole("route_suggestion", true);
        return;
      }
    } catch (err) {
      logCritical("[error] failed to parse message", { err });
    }
  });

  ws.on("close", () => {
    logWarn("[ws] closed");
    stopLoops();
    process.exit(0);
  });

  ws.on("error", (err) => {
    logCritical("[ws] error", { err });
  });
}

process.on("SIGINT", () => {
  logWarn("\n[signal] SIGINT received, shutting down...");
  stopLoops();
  ws?.close();
});

function runScenarioMode() {
  logInfo("Starting scenario mode: simulating OK → WARN → CRITICAL link health");
  devState.connected = true;
  devState.nodeId = "ltp-simulated-node";

  updateOrientationSnapshot(0.62, { direction: "present", strength: 0.55 });
  updateRoutingSnapshot("sector.alpha", "demo routing under scenario", {
    focus_momentum: 0.62,
    time_orientation: { direction: "present", strength: 0.55 },
  });

  const baseHeartbeatTs = Date.now();
  recordHeartbeat(baseHeartbeatTs);
  renderDevConsole("scenario warmup", true);
  startHealthMonitor();

  const sendSimHeartbeat = (label: string) => {
    const ts = Date.now();
    logInfo(`[scenario] heartbeat ${label}`, { at: ts });
    recordHeartbeat(ts);
    renderDevConsole(label);
  };

  setTimeout(() => sendSimHeartbeat("steady-2"), 1500);
  setTimeout(() => sendSimHeartbeat("steady-3"), 3500);

  setTimeout(() => {
    logWarn("[scenario] introducing drift; next heartbeat delayed", {
      warnAfterMs: HEALTH_OK_THRESHOLD_MS,
    });
  }, 8000);

  setTimeout(() => {
    evaluateLinkHealth();
    renderDevConsole("warn drift", true);
  }, HEALTH_OK_THRESHOLD_MS + 5000);

  setTimeout(() => {
    logCritical("[scenario] holding heartbeat to force critical state", {
      criticalAfterMs: HEALTH_WARN_THRESHOLD_MS,
    });
  }, HEALTH_WARN_THRESHOLD_MS - 3000);

  setTimeout(() => {
    evaluateLinkHealth();
    renderDevConsole("critical drift", true);
  }, HEALTH_WARN_THRESHOLD_MS + 1000);

  setTimeout(() => {
    logInfo("[scenario] scenario complete; shutting down");
    stopLoops();
    process.exit(0);
  }, HEALTH_WARN_THRESHOLD_MS + 7000);
}

function main() {
  if (SCENARIO_MODE) {
    runScenarioMode();
    return;
  }

  startRealtimeClient();
}

if (require.main === module) {
  main();
}

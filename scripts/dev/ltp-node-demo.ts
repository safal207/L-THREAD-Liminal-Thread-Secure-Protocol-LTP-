import WebSocket from "ws";

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

const NODE_ADDR = process.env.LTP_NODE_WS_URL ?? "ws://127.0.0.1:7070";
const CLIENT_ID = process.env.LTP_CLIENT_ID ?? "demo-client-1";

console.log(`Connecting to ${NODE_ADDR} as ${CLIENT_ID}...`);

const ws = new WebSocket(NODE_ADDR);

let heartbeatInterval: NodeJS.Timeout | undefined;
let orientationInterval: NodeJS.Timeout | undefined;
let routeInterval: NodeJS.Timeout | undefined;

type DevConsoleState = {
  connected: boolean;
  nodeId?: string;
  lastHeartbeatAck?: number;
  focusMomentum?: number;
  timeOrientation?: TimeOrientationBoostPayload;
  depthScore?: number;
  route?: {
    sector: string;
    reason?: string;
    debug?: RouteSuggestionDebug;
  };
};

const devState: DevConsoleState = {
  connected: false,
};

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
  console.log("[send]", JSON.stringify(msg));
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

  devState.focusMomentum = phase.focus_momentum;
  devState.timeOrientation = phase.time_orientation;
  devState.depthScore = computeDepthScore(phase.focus_momentum, phase.time_orientation);

  sendMessage({
    type: "route_request",
    client_id: CLIENT_ID,
  });
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

function formatTrend(focusMomentum?: number): string {
  if (focusMomentum === undefined) return "unknown";
  if (focusMomentum >= 0.75) return `rising (${focusMomentum.toFixed(2)})`;
  if (focusMomentum >= 0.45) return `stable (${focusMomentum.toFixed(2)})`;
  return `falling (${focusMomentum.toFixed(2)})`;
}

function describeDepth(depthScore?: number): string {
  if (depthScore === undefined) return "n/a";
  if (depthScore >= 4) return `${depthScore} (multi-branch)`;
  if (depthScore >= 2) return `${depthScore} (stable)`;
  return `${depthScore} (shallow)`;
}

function renderDevConsole(reason: string) {
  const orientationText = devState.timeOrientation
    ? `${devState.timeOrientation.direction} (${devState.timeOrientation.strength.toFixed(2)})`
    : "n/a";
  const depthText = describeDepth(devState.depthScore);
  const focusText = formatTrend(devState.focusMomentum);
  const nodeText = devState.connected ? devState.nodeId ?? "(node)" : "disconnected";
  const routerIntent = devState.route
    ? devState.route.sector
    : "awaiting suggestion";

  console.log("\n=== LTP DEV CONSOLE v0.1 ===");
  console.log(`[node] ${nodeText}`);
  console.log(`[heartbeat] last ack: ${devState.lastHeartbeatAck ?? "n/a"}`);

  console.log("\n=== ORIENTATION WEB ===");
  console.log(`focusMomentum: ${focusText}`);
  console.log(`timeOrientation: ${orientationText}`);

  console.log("\n=== TIMEWEAVE ===");
  console.log(`depthScore: ${depthText}`);
  if (devState.depthScore !== undefined && devState.depthScore >= 4) {
    console.log("★ Deep weave – allow speculative routing");
  }

  console.log("\n=== ROUTING ===");
  console.log(`router.intent → sector: ${routerIntent}`);
  if (devState.route?.reason) {
    console.log(`reason: ${devState.route.reason}`);
  }
  if (devState.focusMomentum !== undefined && devState.focusMomentum < 0.45) {
    console.log("⚠ Low focus momentum – suggest soft routing");
  } else {
    console.log("★ Stable focus – normal routing");
  }
  console.log(`debug: ${JSON.stringify(devState.route?.debug ?? {}, null, 2)}`);
  console.log(`update: ${reason}`);
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
}

ws.on("open", () => {
  console.log("[ws] connected");
  sendMessage({
    type: "hello",
    client_id: CLIENT_ID,
    session_tag: "dev-demo",
  });
});

ws.on("message", (data) => {
  try {
    const parsed = JSON.parse(data.toString()) as LtpOutgoingMessage;
    console.log("[recv]", parsed);

    if (parsed.type === "error") {
      console.error(`[error] ${parsed.message}`);
      return;
    }

    if (parsed.type === "hello_ack") {
      if (parsed.accepted) {
        console.log(`[hello] accepted by node ${parsed.node_id}`);
        devState.connected = true;
        devState.nodeId = parsed.node_id;
        renderDevConsole("hello accepted");
        startHeartbeatLoop();
        startOrientationLoop();
        startRouteLoopFallback();
      } else {
        console.error("[hello] rejected by node");
        ws.close();
      }
      return;
    }

    if (parsed.type === "heartbeat_ack") {
      console.log(`[heartbeat] ack for ${parsed.client_id} at ${parsed.timestamp_ms}`);
      devState.lastHeartbeatAck = parsed.timestamp_ms;
      renderDevConsole("heartbeat_ack");
      return;
    }

    if (parsed.type === "route_suggestion") {
      const debug = parsed.debug ?? {};
      const orientation = debug.time_orientation
        ? `${debug.time_orientation.direction}(${debug.time_orientation.strength})`
        : "n/a";
      const focus = debug.focus_momentum ?? "n/a";
      console.log(
        `[route] sector=${parsed.suggested_sector} reason="${parsed.reason ?? "n/a"}" ` +
          `debug: focusMomentum=${focus} orientation=${orientation}`,
      );
      devState.route = {
        sector: parsed.suggested_sector,
        reason: parsed.reason,
        debug,
      };
      renderDevConsole("route_suggestion");
      return;
    }
  } catch (err) {
    console.error("[error] failed to parse message", err);
  }
});

ws.on("close", () => {
  console.log("[ws] closed");
  stopLoops();
  process.exit(0);
});

ws.on("error", (err) => {
  console.error("[ws] error", err);
});

process.on("SIGINT", () => {
  console.log("\n[signal] SIGINT received, shutting down...");
  stopLoops();
  ws.close();
});

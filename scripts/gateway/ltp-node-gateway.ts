import WebSocket from "ws";

export type FocusSnapshotPayload = {
  type: string;
  timestamp?: number | string;
  focusMomentum?: number;
  orientationSummary?: {
    sector?: string;
    intent?: string;
    suggestedMode?: string;
  };
  linkMeta?: {
    latencyMs?: number;
    jitterMs?: number;
    lossRate?: number;
  };
  [key: string]: unknown;
};

export type FocusSnapshotEnvelope = {
  type: "focus_snapshot";
  timestamp: string;
  payload: FocusSnapshotPayload;
};

function toJson(data: WebSocket.RawData): unknown | null {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch (err) {
      console.warn("[gateway] failed to parse upstream string", err);
      return null;
    }
  }

  if (Buffer.isBuffer(data)) {
    return toJson(data.toString("utf-8"));
  }

  return null;
}

export function mapToFocusSnapshotEnvelope(raw: unknown): FocusSnapshotEnvelope | null {
  if (!raw || typeof raw !== "object") return null;
  const message = raw as Record<string, unknown>;
  if (message.type !== "focus_snapshot") return null;

  const tsField = message.timestamp;
  const timestamp =
    typeof tsField === "string"
      ? tsField
      : typeof tsField === "number"
        ? new Date(tsField).toISOString()
        : new Date().toISOString();

  return {
    type: "focus_snapshot",
    timestamp,
    payload: message as FocusSnapshotPayload,
  };
}

function connectHudMonitor(url: string, onReady: (socket: WebSocket) => void) {
  let monitor: WebSocket | null = null;

  const establish = () => {
    monitor = new WebSocket(url);
    monitor.on("open", () => {
      console.log(`[gateway] connected to HUD monitor at ${url}`);
      onReady(monitor!);
    });
    monitor.on("close", () => {
      console.warn(`[gateway] HUD monitor connection closed. Retrying soon...`);
      setTimeout(establish, 2000);
    });
    monitor.on("error", (err) => {
      console.warn("[gateway] HUD monitor error", err);
    });
  };

  establish();
  return () => monitor?.close();
}

function createUpstreamConnector(
  url: string,
  onSnapshot: (snapshot: FocusSnapshotEnvelope) => void,
) {
  const backoff = [1000, 2000, 5000, 10000];
  let attempt = 0;
  let socket: WebSocket | null = null;

  const connect = () => {
    socket = new WebSocket(url);
    socket.on("open", () => {
      attempt = 0;
      console.log(`[gateway] connected to upstream ${url}`);
      try {
        socket?.send(
          JSON.stringify({ type: "subscribe", topics: ["focus_snapshot"], role: "hud-gateway" }),
        );
      } catch (err) {
        console.warn("[gateway] failed to send subscription", err);
      }
    });

    socket.on("message", (data) => {
      const json = toJson(data);
      const envelope = mapToFocusSnapshotEnvelope(json ?? {});
      if (envelope) {
        onSnapshot(envelope);
      }
    });

    socket.on("close", () => {
      const delay = backoff[Math.min(backoff.length - 1, attempt++)];
      console.warn(`[gateway] upstream closed. reconnecting in ${delay}ms`);
      setTimeout(connect, delay);
    });

    socket.on("error", (err) => {
      console.warn("[gateway] upstream error", err);
      socket?.close();
    });
  };

  connect();
  return () => socket?.close();
}

function startGateway() {
  const upstreamUrl = process.env.LTP_UPSTREAM_WS ?? "ws://127.0.0.1:8080/ws";
  const hudMonitorUrl = process.env.HUD_MONITOR_WS ?? "ws://127.0.0.1:8090/focus";

  let hudSocket: WebSocket | null = null;

  const stopHud = connectHudMonitor(hudMonitorUrl, (socket) => {
    hudSocket = socket;
  });

  const stopUpstream = createUpstreamConnector(upstreamUrl, (snapshot) => {
    if (hudSocket && hudSocket.readyState === WebSocket.OPEN) {
      hudSocket.send(JSON.stringify(snapshot));
    }
  });

  process.on("SIGINT", () => {
    console.log("[gateway] shutting down...");
    stopUpstream();
    stopHud();
    process.exit(0);
  });
}

if (require.main === module) {
  startGateway();
}

export { startGateway };

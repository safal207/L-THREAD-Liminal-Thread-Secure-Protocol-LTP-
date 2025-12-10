import WebSocket from "ws";

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
      type: "orientation";
      client_id: string;
      focus_momentum?: number;
      time_orientation?: TimeOrientationBoostPayload;
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

export interface LtpClientHandlers {
  onConnected?: () => void;
  onHelloAck?: (message: Extract<LtpOutgoingMessage, { type: "hello_ack" }>) => void;
  onHeartbeatAck?: (
    message: Extract<LtpOutgoingMessage, { type: "heartbeat_ack" }>,
    metrics: { latencyMs: number; jitterMs?: number },
  ) => void;
  onOrientation?: (message: Extract<LtpOutgoingMessage, { type: "orientation" }>) => void;
  onRouteSuggestion?: (message: Extract<LtpOutgoingMessage, { type: "route_suggestion" }>) => void;
  onError?: (message: Extract<LtpOutgoingMessage, { type: "error" }>, raw?: unknown) => void;
  onClose?: () => void;
}

export interface LtpClientOptions {
  clientId?: string;
  sessionTag?: string;
  heartbeatIntervalMs?: number;
}

export interface LtpClient {
  connect(): void;
  disconnect(): void;
}

function safeSend(ws: WebSocket | null, payload: LtpIncomingMessage) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

export function createLtpClient(
  endpoint: string,
  handlers: LtpClientHandlers = {},
  options: LtpClientOptions = {},
): LtpClient {
  const clientId = options.clientId ?? "ltp-focus-hud";
  const sessionTag = options.sessionTag ?? "focus-hud";
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 5000;

  let ws: WebSocket | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let lastLatencyMs: number | undefined;

  const startHeartbeatLoop = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    heartbeatTimer = setInterval(() => {
      safeSend(ws, { type: "heartbeat", client_id: clientId, timestamp_ms: Date.now() });
    }, heartbeatIntervalMs);
    safeSend(ws, { type: "heartbeat", client_id: clientId, timestamp_ms: Date.now() });
  };

  const stopHeartbeatLoop = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const handleMessage = (raw: WebSocket.RawData) => {
    try {
      const parsed = JSON.parse(raw.toString()) as LtpOutgoingMessage;

      if (parsed.type === "hello_ack") {
        handlers.onHelloAck?.(parsed);
        return;
      }

      if (parsed.type === "heartbeat_ack") {
        const latencyMs = Math.max(0, Date.now() - parsed.timestamp_ms);
        const jitterMs = lastLatencyMs !== undefined ? Math.abs(latencyMs - lastLatencyMs) : undefined;
        lastLatencyMs = latencyMs;
        handlers.onHeartbeatAck?.(parsed, { latencyMs, jitterMs });
        return;
      }

      if (parsed.type === "orientation") {
        handlers.onOrientation?.(parsed);
        return;
      }

      if (parsed.type === "route_suggestion") {
        handlers.onRouteSuggestion?.(parsed);
        return;
      }

      if (parsed.type === "error") {
        handlers.onError?.(parsed);
      }
    } catch (err) {
      handlers.onError?.({ type: "error", message: "Failed to parse message" }, err);
    }
  };

  return {
    connect() {
      ws = new WebSocket(endpoint);

      ws.on("open", () => {
        handlers.onConnected?.();
        safeSend(ws, { type: "hello", client_id: clientId, session_tag: sessionTag });
        startHeartbeatLoop();
      });

      ws.on("message", handleMessage);

      ws.on("close", () => {
        stopHeartbeatLoop();
        handlers.onClose?.();
      });

      ws.on("error", (err) => {
        handlers.onError?.({ type: "error", message: "WebSocket error" }, err);
      });
    },
    disconnect() {
      stopHeartbeatLoop();
      ws?.close();
      ws = null;
    },
  };
}

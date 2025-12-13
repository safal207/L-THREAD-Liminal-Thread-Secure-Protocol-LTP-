import WebSocket, { WebSocketServer } from "ws";
import { resolveSelfTestMode, runSelfTest, type SelfTestReport } from "../../sdk/js/src/conformance/selfTest";

export interface ConformanceSelfTestRequest {
  type: "conformance_self_test";
  v?: string;
  id?: string;
  ts?: number;
  payload?: { mode?: string };
}

export interface ConformanceReportFrame {
  type: "conformance_report";
  v: "0.1";
  id: string;
  ts: number;
  payload: SelfTestReport;
}

export interface ConformanceErrorFrame {
  type: "error";
  v: "0.1";
  id?: string;
  ts: number;
  payload: { code: string; message: string };
}

const buildReportFrame = (request: ConformanceSelfTestRequest, report: SelfTestReport): ConformanceReportFrame => ({
  type: "conformance_report",
  v: "0.1",
  id: request.id ?? "conformance-report",
  ts: Date.now(),
  payload: report,
});

const buildErrorFrame = (
  request: ConformanceSelfTestRequest | undefined,
  code: string,
  message: string,
): ConformanceErrorFrame => ({
  type: "error",
  v: "0.1",
  id: request?.id,
  ts: Date.now(),
  payload: { code, message },
});

export function handleConformanceSelfTestMessage(
  message: ConformanceSelfTestRequest,
): ConformanceReportFrame | ConformanceErrorFrame {
  if (message.v && message.v !== "0.1") {
    return buildErrorFrame(message, "invalid_version", "Unsupported protocol version");
  }

  if (message.type !== "conformance_self_test") {
    return buildErrorFrame(message, "unknown_type", "Unsupported message type");
  }

  const mode = resolveSelfTestMode(message.payload?.mode);
  const { report } = runSelfTest({ mode });
  return buildReportFrame(message, report);
}

function sendFrame(socket: WebSocket, frame: ConformanceReportFrame | ConformanceErrorFrame) {
  socket.send(JSON.stringify(frame));
}

export function createConformanceWSServer(options?: { port?: number; path?: string }) {
  const port = options?.port ?? Number(process.env.WS_PORT) || 4002;
  const path = options?.path ?? "/ws/conformance-self-test";
  const wss = new WebSocketServer({ port, path });

  wss.on("connection", (socket) => {
    socket.on("message", (data) => {
      let parsed: any;
      try {
        parsed = JSON.parse(data.toString());
      } catch (error) {
        sendFrame(socket, buildErrorFrame(undefined, "invalid_json", "Invalid JSON payload"));
        return;
      }

      const response = handleConformanceSelfTestMessage(parsed as ConformanceSelfTestRequest);
      sendFrame(socket, response);
    });
  });

  wss.on("listening", () => {
    const address = wss.address();
    const resolvedPort = typeof address === "object" && address ? address.port : port;
    console.log(
      `L-THREAD WS Conformance Server listening on ws://localhost:${resolvedPort}${path}`,
    );
  });

  return wss;
}

function startServer() {
  createConformanceWSServer();
}

if (require.main === module) {
  startServer();
}

import WebSocket, { WebSocketServer } from "ws";
import {
  buildDemoScenario,
  explainRoutingForDemoScenario,
  explainRoutingForScenario,
  type RoutingExplainView,
} from "../demos/explainRoutingDemo";
import { type FutureWeaveGraphOptions } from "../visualization/futureWeaveGraph";
import { type TemporalOrientationView, type RoutingDecision } from "../routing/temporal-multipath";

export type OrientationDemoClientMessage =
  | { type: "ping"; tick?: number }
  | { type: "explain_demo"; tick?: number }
  | {
      type: "explain_custom";
      intent?: string;
      focusMomentum?: number;
      volatility?: number;
      currentSector?: string;
      maxBranches?: number;
      showMeta?: boolean;
      tick?: number;
    };

export interface OrientationDemoServerMessage {
  type: "explain_result" | "error" | "pong";
  tick?: number;
  decision?: string;
  reasons?: string[];
  metrics?: Record<string, number | undefined>;
  graph?: string;
  suggestion?: any;
  rawView?: RoutingExplainView;
  errorCode?: string;
  errorMessage?: string;
}

function parseNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function buildScenarioFromMessage(message: OrientationDemoClientMessage): {
  orientation: TemporalOrientationView;
  routingDecision: RoutingDecision;
  intent: string;
  graphOptions?: FutureWeaveGraphOptions;
} {
  const base = buildDemoScenario();
  const orientation: TemporalOrientationView = { ...base.orientation };
  const routingDecision: RoutingDecision = { options: [...base.routingDecision.options] };
  let intent = base.intent;
  const graphOptions: FutureWeaveGraphOptions = {};

  if (message.type === "explain_custom") {
    if (typeof message.intent === "string" && message.intent.trim().length > 0) {
      intent = message.intent;
    }

    const focusMomentum = parseNumber(message.focusMomentum);
    if (focusMomentum !== undefined) {
      orientation.focusMomentum = focusMomentum;
    }

    const volatility = parseNumber(message.volatility);
    if (volatility !== undefined) {
      orientation.volatility = volatility;
    }

    if (typeof message.currentSector === "string" && message.currentSector.trim().length > 0) {
      orientation.currentSector = message.currentSector;
    }

    const maxBranches = parseNumber(message.maxBranches);
    if (maxBranches !== undefined) {
      graphOptions.maxBranches = maxBranches;
    }

    if (typeof message.showMeta === "boolean") {
      graphOptions.showMeta = message.showMeta;
    }
  }

  return { orientation, routingDecision, intent, graphOptions };
}

function mapViewToServerMessage(view: RoutingExplainView, tick?: number): OrientationDemoServerMessage {
  const decisionSummary = `Routing intent: ${view.decision.intent}; chosen path: ${
    view.decision.chosenBranchLabel ?? view.decision.chosenPathId
  }`;

  return {
    type: "explain_result",
    tick,
    decision: decisionSummary,
    reasons: view.decision.reasons,
    metrics: {
      focusMomentum: view.decision.metrics.focusMomentum,
      volatility: view.decision.metrics.volatility,
      likelihood: view.decision.metrics.likelihood,
      depthScore: view.decision.metrics.depthScore as number | undefined,
    },
    graph: view.graph,
    suggestion: view.suggestion,
    rawView: view,
  };
}

export async function handleOrientationDemoMessage(
  message: OrientationDemoClientMessage,
): Promise<OrientationDemoServerMessage> {
  if (message.type === "ping") {
    return { type: "pong", tick: message.tick };
  }

  if (message.type === "explain_demo") {
    const view = explainRoutingForDemoScenario();
    return mapViewToServerMessage(view, message.tick);
  }

  if (message.type === "explain_custom") {
    const scenario = buildScenarioFromMessage(message);
    const view = explainRoutingForScenario(scenario);
    return mapViewToServerMessage(view, message.tick);
  }

  return {
    type: "error",
    errorCode: "unknown_type",
    errorMessage: "Unsupported message type",
    tick: (message as any)?.tick,
  };
}

function sendError(socket: WebSocket, errorCode: string, errorMessage: string, tick?: number) {
  const payload: OrientationDemoServerMessage = { type: "error", errorCode, errorMessage, tick };
  socket.send(JSON.stringify(payload));
}

export function createOrientationDemoWSServer(options?: { port?: number; path?: string }) {
  const port = options?.port ?? Number(process.env.WS_PORT) || 4001;
  const path = options?.path ?? "/ws/orientation-demo";

  const wss = new WebSocketServer({ port, path });

  wss.on("connection", (socket) => {
    console.log("Client connected to orientation demo WS");
    socket.send(JSON.stringify({ type: "pong", tick: 0 } satisfies OrientationDemoServerMessage));

    socket.on("message", async (data) => {
      const payloadText = data.toString();
      let parsed: any;

      try {
        parsed = JSON.parse(payloadText);
      } catch (error) {
        sendError(socket, "invalid_json", "Invalid JSON message");
        return;
      }

      if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
        sendError(socket, "unknown_type", "Unsupported message type");
        return;
      }

      try {
        const response = await handleOrientationDemoMessage(parsed as OrientationDemoClientMessage);
        socket.send(JSON.stringify(response));
      } catch (error) {
        console.error("Failed to handle orientation demo message", error);
        sendError(socket, "internal_error", "Failed to compute explanation", parsed.tick);
      }
    });
  });

  wss.on("listening", () => {
    const address = wss.address();
    const resolvedPort = typeof address === "object" && address ? address.port : port;
    console.log(`L-THREAD WS Demo Server listening on ws://localhost:${resolvedPort}${path}`);
  });

  return wss;
}

function startOrientationDemoServer() {
  createOrientationDemoWSServer();
}

if (require.main === module) {
  startOrientationDemoServer();
}

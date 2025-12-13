import http from "http";
import { URL } from "url";
import {
  buildDemoScenario,
  explainRoutingForScenario,
  explainRoutingForDemoScenario,
  formatRoutingExplanation,
  type RoutingExplainView,
} from "../demos/explainRoutingDemo";
import { type FutureWeaveGraphOptions } from "../visualization/futureWeaveGraph";
import { type TemporalOrientationView, type RoutingDecision } from "../routing/temporal-multipath";
import { resolveSelfTestMode, runSelfTest } from "../../sdk/js/src/conformance/selfTest";
import {
  type ConformanceVerifyRequest,
  type ConformanceVerifyResponse,
  verifyConformance,
} from "./conformanceVerifier";

export interface ExplainRoutingResponse {
  decision: string;
  formattedExplanation: string;
  reasons: string[];
  metrics: {
    focusMomentum?: number;
    volatility?: number;
    likelihoodTop?: number;
    depthScore?: number;
    [key: string]: number | undefined;
  };
  chosenPathId?: string;
  chosenBranchLabel?: string | null;
  graph: string;
  suggestion: any;
  rawView: RoutingExplainView;
}

function parseNumber(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  if (["true", "1", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["false", "0", "no", "off"].includes(value.toLowerCase())) return false;
  return undefined;
}

function buildScenarioFromParams(searchParams: URLSearchParams): {
  orientation: TemporalOrientationView;
  routingDecision: RoutingDecision;
  intent: string;
  graphOptions?: FutureWeaveGraphOptions;
} {
  const base = buildDemoScenario();
  const orientation: TemporalOrientationView = { ...base.orientation };
  const routingDecision: RoutingDecision = { options: [...base.routingDecision.options] };

  const intent = searchParams.get("intent") ?? base.intent;

  const focusMomentum = parseNumber(searchParams.get("focusMomentum"));
  if (focusMomentum !== undefined) {
    orientation.focusMomentum = focusMomentum;
  }

  const volatility = parseNumber(searchParams.get("volatility"));
  if (volatility !== undefined) {
    orientation.volatility = volatility;
  }

  const currentSector = searchParams.get("currentSector");
  if (currentSector) {
    orientation.currentSector = currentSector;
  }

  const graphOptions: FutureWeaveGraphOptions = {};
  const maxBranches = parseNumber(searchParams.get("maxBranches"));
  if (maxBranches !== undefined) {
    graphOptions.maxBranches = maxBranches;
  }

  const showMeta = parseBoolean(searchParams.get("showMeta"));
  if (showMeta !== undefined) {
    graphOptions.showMeta = showMeta;
  }

  return { orientation, routingDecision, intent, graphOptions };
}

export function handleExplainRoutingRequest(searchParams: URLSearchParams): ExplainRoutingResponse {
  const mode = searchParams.get("mode");

  const view =
    mode === "demo" || searchParams.size === 0
      ? explainRoutingForDemoScenario()
      : explainRoutingForScenario(buildScenarioFromParams(searchParams));

  const formattedExplanation = formatRoutingExplanation(view);
  const decisionSummary = `Routing intent: ${view.decision.intent}; chosen path: ${
    view.decision.chosenBranchLabel ?? view.decision.chosenPathId
  }`;

  return {
    decision: decisionSummary,
    formattedExplanation,
    reasons: view.decision.reasons,
    metrics: {
      focusMomentum: view.decision.metrics.focusMomentum,
      volatility: view.decision.metrics.volatility,
      likelihoodTop: view.decision.metrics.likelihood,
      depthScore: view.decision.metrics.depthScore as number | undefined,
    },
    chosenPathId: view.decision.chosenPathId,
    chosenBranchLabel: view.decision.chosenBranchLabel ?? null,
    graph: view.graph,
    suggestion: view.suggestion,
    rawView: view,
  };
}

export function createDemoServer() {
  return http.createServer((req, res) => {
    if (!req.url) {
      res.statusCode = 400;
      res.end();
      return;
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "GET") {
      if (requestUrl.pathname === "/health") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (requestUrl.pathname === "/conformance/self-test") {
        try {
          const mode = resolveSelfTestMode(requestUrl.searchParams.get("mode"));
          const { report } = runSelfTest({ mode });
          res.statusCode = report.ok ? 200 : 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify(
              {
                ok: report.ok,
                level: report.level,
                determinismHash: report.determinismHash,
                branches: report.branchesCount,
                errors: report.errors,
                mode: report.mode,
                received: report.receivedFrames,
                processed: report.processedFrames,
                emitted: report.emittedFrames,
                deduped: report.dedupedFrames,
              },
              null,
              2,
            ),
          );
        } catch (error) {
          console.error("Failed to handle /conformance/self-test", error);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: false,
              error: "internal_error",
              message: "Failed to run LTP conformance self-test",
            }),
          );
        }
        return;
      }

      if (requestUrl.pathname === "/demo/explain-routing") {
        try {
          const response = handleExplainRoutingRequest(requestUrl.searchParams);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(response, null, 2));
        } catch (error) {
          console.error("Failed to handle /demo/explain-routing", error);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: "internal_error",
              message: "Something went wrong in routing explanation",
            }),
          );
        }
        return;
      }
    }

    if (req.method === "POST" && requestUrl.pathname === "/conformance/verify") {
      const chunks: Buffer[] = [];
      const MAX_BODY_BYTES = 512 * 1024; // 512 KiB
      let receivedBytes = 0;

      req
        .on("data", (chunk) => {
          receivedBytes += chunk.length;
          if (receivedBytes > MAX_BODY_BYTES) {
            res.statusCode = 413;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: false,
                error: "payload_too_large",
                message: "Payload exceeds maximum size of 512 KiB",
              }),
            );
            req.destroy();
            return;
          }

          chunks.push(chunk);
        })
        .on("end", () => {
          try {
            const bodyText = Buffer.concat(chunks).toString("utf-8");
            const payload: ConformanceVerifyRequest = bodyText.length > 0 ? JSON.parse(bodyText) : { frames: [] };

            const verification: ConformanceVerifyResponse & { httpStatus: number } = verifyConformance(payload.frames);

            if (verification.frameCount > 5000) {
              res.statusCode = 413;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: "payload_too_large",
                  message: "Frame count exceeds safety limit of 5000",
                }),
              );
              return;
            }

            res.statusCode = verification.httpStatus;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(verification, null, 2));
          } catch (error) {
            console.error("Failed to verify conformance", error);
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: false,
                error: "invalid_request",
                message: "Unable to parse request body as JSON",
              }),
            );
          }
        })
        .on("error", (error) => {
          console.error("Failed to read request body", error);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "stream_error" }));
        });
      return;
    }

    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "not_found_or_method_not_allowed" }));
  });
}

function startServer() {
  const port = Number(process.env.PORT) || 4000;
  const server = createDemoServer();

  server.listen(port, () => {
    console.log(`L-THREAD Demo Server listening on http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

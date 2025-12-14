import { normalizeRouteBranches, LTP_VERSION } from "../../sdk/js/src/frames/protocolSurface.v0.1";
import { type LTPFrame, type RouteResponsePayload } from "../../sdk/js/src/frames/frameSchema";

const BASE_TS = 1730000000500;
const nextTs = (() => {
  let cursor = BASE_TS;
  return () => {
    cursor += 35;
    return cursor;
  };
})();

const buildDegradedFlow = (): { frames: LTPFrame[]; routeResponse: RouteResponsePayload } => {
  const routeResponse: RouteResponsePayload = {
    branches: [
      { path: ["recover", "drain"], confidence: 0.45, rationale: "load-aware" },
      { path: ["primary", "ship"], confidence: 0.33, rationale: "possible but slower" },
      { path: ["explore", "shed"], confidence: 0.22, rationale: "reduce scope" },
    ],
    selection: "recover",
  };

  const frames: LTPFrame[] = [
    { v: LTP_VERSION, id: "hello-degraded-001", ts: nextTs(), type: "hello", payload: { role: "client", message: "degraded demo" } },
    { v: LTP_VERSION, id: "heartbeat-degraded-001", ts: nextTs(), type: "heartbeat", payload: { seq: 1, status: "high_load" } },
    {
      v: LTP_VERSION,
      id: "orientation-degraded-001",
      ts: nextTs(),
      type: "orientation",
      payload: { origin: "client.examples", destination: "ltp.node", mode: "load" },
    },
    {
      v: LTP_VERSION,
      id: "route-request-degraded-001",
      ts: nextTs(),
      type: "route_request",
      payload: { goal: "degraded routing", context: ["demo", "v0.1", "load"] },
    },
    {
      v: LTP_VERSION,
      id: "route-response-degraded-001",
      ts: nextTs(),
      type: "route_response",
      payload: routeResponse,
    },
  ];

  return { frames, routeResponse };
};

const printFlow = (frames: LTPFrame[], routeResponse: RouteResponsePayload): void => {
  const lines: string[] = [];
  lines.push("=== DEGRADED MODE ===");
  lines.push("LTP v0.1 :: Graceful downgrade under load");
  lines.push("----------------------------------------");
  frames.forEach((frame, idx) => {
    const payloadHint =
      frame.type === "heartbeat"
        ? `seq=${(frame.payload as { seq: number }).seq}; status=${(frame.payload as { status?: string }).status ?? "n/a"}`
        : frame.type === "orientation"
          ? `mode=${(frame.payload as { mode: string }).mode}`
          : frame.type === "route_request"
            ? `goal=${(frame.payload as { goal: string }).goal}`
            : frame.type === "route_response"
              ? `selection=${routeResponse.selection ?? "n/a"}`
              : `message=${(frame.payload as { message: string }).message}`;

    lines.push(`${idx + 1}. ${frame.type} @ ${new Date(frame.ts).toISOString()} (${payloadHint})`);
  });

  lines.push("");
  lines.push("Routing branches (degraded confidences):");
  const branches = normalizeRouteBranches(routeResponse.branches).sort((a, b) => b.confidence - a.confidence);
  branches.forEach((branch) => {
    const rationale = branch.rationale ? ` (${branch.rationale})` : "";
    lines.push(`- ${branch.name}: ${(branch.confidence * 100).toFixed(1)}% path=${branch.path.join(" -> ")}${rationale}`);
  });

  // eslint-disable-next-line no-console
  console.log(lines.join("\n"));
};

export const runDegradedLoadScenario = (): void => {
  const { frames, routeResponse } = buildDegradedFlow();
  printFlow(frames, routeResponse);
};

if (require.main === module) {
  runDegradedLoadScenario();
}

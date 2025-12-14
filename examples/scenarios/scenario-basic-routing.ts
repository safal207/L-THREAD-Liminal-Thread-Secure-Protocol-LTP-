import { normalizeRouteBranches, LTP_VERSION } from "../../sdk/js/src/frames/protocolSurface.v0.1";
import { type LTPFrame, type RouteResponsePayload } from "../../sdk/js/src/frames/frameSchema";

const BASE_TS = 1730000000000;
const nextTs = (() => {
  let cursor = BASE_TS;
  return () => {
    cursor += 20;
    return cursor;
  };
})();

const buildBasicRouting = (): { frames: LTPFrame[]; routeResponse: RouteResponsePayload } => {
  const routeResponse: RouteResponsePayload = {
    branches: [
      { path: ["primary", "ship"], confidence: 0.62, rationale: "best-fit route" },
      { path: ["recover", "stabilize"], confidence: 0.25, rationale: "safe fallback" },
      { path: ["explore", "test"], confidence: 0.13, rationale: "low-risk exploration" },
    ],
    selection: "primary",
  };

  const frames: LTPFrame[] = [
    { v: LTP_VERSION, id: "hello-basic-001", ts: nextTs(), type: "hello", payload: { role: "client", message: "basic demo" } },
    { v: LTP_VERSION, id: "heartbeat-basic-001", ts: nextTs(), type: "heartbeat", payload: { seq: 1, status: "ok" } },
    {
      v: LTP_VERSION,
      id: "orientation-basic-001",
      ts: nextTs(),
      type: "orientation",
      payload: { origin: "client.examples", destination: "ltp.node", mode: "stable" },
    },
    {
      v: LTP_VERSION,
      id: "route-request-basic-001",
      ts: nextTs(),
      type: "route_request",
      payload: { goal: "basic routing", context: ["demo", "v0.1"] },
    },
    {
      v: LTP_VERSION,
      id: "route-response-basic-001",
      ts: nextTs(),
      type: "route_response",
      payload: routeResponse,
    },
  ];

  return { frames, routeResponse };
};

const printFlow = (frames: LTPFrame[], routeResponse: RouteResponsePayload): void => {
  const lines: string[] = [];
  lines.push("LTP v0.1 :: Basic routing under stable focus");
  lines.push("------------------------------------------------");
  frames.forEach((frame, idx) => {
    const payloadHint =
      frame.type === "heartbeat"
        ? `seq=${(frame.payload as { seq: number }).seq}`
        : frame.type === "orientation"
          ? `origin=${(frame.payload as { origin: string }).origin}`
          : frame.type === "route_request"
            ? `goal=${(frame.payload as { goal: string }).goal}`
            : frame.type === "route_response"
              ? `selection=${routeResponse.selection ?? "n/a"}`
              : `message=${(frame.payload as { message: string }).message}`;

    lines.push(`${idx + 1}. ${frame.type} @ ${new Date(frame.ts).toISOString()} (${payloadHint})`);
  });

  lines.push("");
  lines.push("Routing branches:");
  const branches = normalizeRouteBranches(routeResponse.branches).sort((a, b) => b.confidence - a.confidence);
  branches.forEach((branch) => {
    const rationale = branch.rationale ? ` (${branch.rationale})` : "";
    lines.push(`- ${branch.name}: ${(branch.confidence * 100).toFixed(1)}% path=${branch.path.join(" -> ")}${rationale}`);
  });

  // eslint-disable-next-line no-console
  console.log(lines.join("\n"));
};

export const runBasicRoutingScenario = (): void => {
  const { frames, routeResponse } = buildBasicRouting();
  printFlow(frames, routeResponse);
};

if (require.main === module) {
  runBasicRoutingScenario();
}

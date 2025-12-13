import {
  normalizeRouteBranches,
  LTP_VERSION,
  FRAME_TYPES_V0_1,
} from "../../sdk/js/src/frames/protocolSurface.v0.1";
import {
  type LTPFrame,
  type RouteResponsePayload,
  type OrientationPayload,
} from "../../sdk/js/src/frames/frameSchema";

const BASE_TS = 1700000000000;

const nextTs = (() => {
  let cursor = BASE_TS;
  return () => {
    cursor += 25;
    return cursor;
  };
})();

export const buildCanonicalFrames = (): LTPFrame[] => {
  const orientation: OrientationPayload = {
    origin: "client.demo",
    destination: "ltp-core",
    mode: "canonical",
  };

  const routeResponse: RouteResponsePayload = {
    branches: {
      primary: { path: ["primary", "ship"], confidence: 0.64, rationale: "steady delivery" },
      recover: { path: ["recover", "stabilize"], confidence: 0.22, rationale: "fallback ready" },
      explore: { path: ["explore", "test"], confidence: 0.14, rationale: "light exploration" },
    },
    selection: "primary",
  };

  const frames: LTPFrame[] = [
    {
      v: LTP_VERSION,
      id: "hello-001",
      ts: nextTs(),
      type: "hello",
      payload: { role: "client", message: "init canonical demo" },
    },
    {
      v: LTP_VERSION,
      id: "heartbeat-001",
      ts: nextTs(),
      type: "heartbeat",
      payload: { seq: 1, status: "ok" },
    },
    {
      v: LTP_VERSION,
      id: "orientation-001",
      ts: nextTs(),
      type: "orientation",
      payload: orientation,
    },
    {
      v: LTP_VERSION,
      id: "route-request-001",
      ts: nextTs(),
      type: "route_request",
      payload: { goal: "deliver canonical flow", context: ["ltp", "demo"] },
    },
    {
      v: LTP_VERSION,
      id: "route-response-001",
      ts: nextTs(),
      type: "route_response",
      payload: routeResponse,
    },
  ];

  return frames;
};

const formatFrameSummary = (frame: LTPFrame): string => {
  const label = `${frame.type}`;
  const payloadHint =
    frame.type === "hello"
      ? `message=${(frame.payload as { message: string }).message}`
      : frame.type === "heartbeat"
        ? `seq=${(frame.payload as { seq: number }).seq}`
        : frame.type === "orientation"
          ? `origin=${(frame.payload as OrientationPayload).origin}`
          : frame.type === "route_request"
            ? `goal=${(frame.payload as { goal: string }).goal}`
            : frame.type === "route_response"
              ? `selection=${(frame.payload as RouteResponsePayload).selection ?? "n/a"}`
              : "payload";

  return `${new Date(frame.ts).toISOString()} :: ${label} (${payloadHint})`;
};

const formatTimeline = (frames: LTPFrame[]): string => {
  const lines: string[] = [];
  lines.push("Frame timeline (v0.1)");
  lines.push("---------------------");
  frames.forEach((frame, idx) => {
    lines.push(`${idx + 1}. ${formatFrameSummary(frame)}`);
  });
  lines.push("");
  return lines.join("\n");
};

const formatRoutingResult = (payload: RouteResponsePayload): string => {
  const branches = normalizeRouteBranches(payload.branches).sort((a, b) => b.confidence - a.confidence);
  const lines: string[] = [];
  lines.push("Routing branches");
  lines.push("----------------");
  branches.forEach((branch) => {
    const rationale = branch.rationale ? ` (${branch.rationale})` : "";
    lines.push(`${branch.name}: ${(branch.confidence * 100).toFixed(1)}% path=${branch.path.join(" -> ")}${rationale}`);
  });

  if (payload.selection) {
    lines.push("");
    lines.push(`selection: ${payload.selection}`);
  }

  lines.push("");
  return lines.join("\n");
};

const formatExplainability = (orientation: OrientationPayload, payload: RouteResponsePayload): string => {
  const branches = normalizeRouteBranches(payload.branches);
  const primary = branches.find((branch) => branch.name === (payload.selection ?? "primary")) ?? branches[0];
  const secondary = branches[1];
  const delta = primary && secondary ? Number((primary.confidence - secondary.confidence).toFixed(2)) : null;

  const lines: string[] = [];
  lines.push("Explainability factors");
  lines.push("---------------------");
  lines.push(`version locked: ${LTP_VERSION}`);
  lines.push(`orientation: ${orientation.origin} -> ${orientation.destination} (${orientation.mode})`);
  if (primary) {
    lines.push(`chosen branch: ${primary.name} @ ${(primary.confidence * 100).toFixed(1)}% (${primary.path.join(" -> ")})`);
  }
  if (delta !== null) {
    lines.push(`confidence delta vs next: ${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(0)}bps`);
  }
  if (branches.some((branch) => branch.rationale)) {
    lines.push(`rationales: ${branches
      .filter((branch) => branch.rationale)
      .map((branch) => `${branch.name}=${branch.rationale}`)
      .join("; ")}`);
  }
  lines.push(`surface includes: ${FRAME_TYPES_V0_1.join(", ")}`);
  lines.push("");

  return lines.join("\n");
};

export const renderCanonicalDemo = (): string => {
  const frames = buildCanonicalFrames();
  const routeResponse = frames.find((frame) => frame.type === "route_response")?.payload as RouteResponsePayload;
  const orientation = frames.find((frame) => frame.type === "orientation")?.payload as OrientationPayload;

  const sections = [
    "LTP v0.1 Canonical Flow",
    "========================",
    "",
    formatTimeline(frames),
    formatRoutingResult(routeResponse),
    formatExplainability(orientation, routeResponse),
  ];

  const output = sections.join("\n");
  // eslint-disable-next-line no-console
  console.log(output);
  return output;
};

if (require.main === module) {
  renderCanonicalDemo();
}

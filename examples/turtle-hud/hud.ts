export type TimeDirection = "past" | "now" | "future";
export type SocialAxis = "self" | "family" | "world";

export interface TurtleSnapshotLike {
  mainTimeDirection: TimeDirection;
  mainSocialAxis: SocialAxis;
  timeWeaveDepthScore?: number; // 0..1
  focusMomentumScore?: number; // 0..1
  metaHint?: string;
}

const WS_URL =
  typeof window !== "undefined" && (window as any).LTP_HUD_WS_URL
    ? (window as any).LTP_HUD_WS_URL
    : "ws://localhost:4001/ws/orientation-demo";

const directionPill = typeof document !== "undefined" ? document.getElementById("direction-pill") : null;
const axisPill = typeof document !== "undefined" ? document.getElementById("axis-pill") : null;
const focusBar = typeof document !== "undefined" ? document.getElementById("focus-bar-fill") : null;
const focusLabel = typeof document !== "undefined" ? document.getElementById("focus-label") : null;
const depthLabel = typeof document !== "undefined" ? document.getElementById("depth-label") : null;
const modeHint = typeof document !== "undefined" ? document.getElementById("mode-hint") : null;
const metaHint = typeof document !== "undefined" ? document.getElementById("meta-hint") : null;
const wsStatus = typeof document !== "undefined" ? document.getElementById("ws-status") : null;

function updateWsStatus(label: string, state?: "connected" | "error") {
  if (!wsStatus) return;
  wsStatus.textContent = label;
  wsStatus.classList.toggle("connected", state === "connected");
  wsStatus.classList.toggle("error", state === "error");
}

function clampScore(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function focusMomentumToBand(score?: number): "low" | "medium" | "high" {
  const value = clampScore(score);
  if (value < 0.3) return "low";
  if (value <= 0.7) return "medium";
  return "high";
}

export function timeWeaveDepthToBand(score?: number): "shallow" | "layered" | "deep" {
  const value = clampScore(score);
  if (value < 0.3) return "shallow";
  if (value <= 0.7) return "layered";
  return "deep";
}

export function deriveModeHint(snapshot: TurtleSnapshotLike): "explore" | "stabilize" | "commit" {
  const focusBand = focusMomentumToBand(snapshot.focusMomentumScore);
  const depthBand = timeWeaveDepthToBand(snapshot.timeWeaveDepthScore);

  if (focusBand === "high" && snapshot.mainTimeDirection === "future") return "commit";
  if (depthBand === "deep" && (snapshot.mainSocialAxis === "family" || snapshot.mainSocialAxis === "world")) {
    return "explore";
  }
  return "stabilize";
}

function highlightDirection(direction?: string) {
  document.querySelectorAll<HTMLElement>(".compass-segment").forEach((segment) => {
    const isActive = segment.dataset.direction === direction;
    segment.classList.toggle("active", isActive);
  });
}

function renderOrientation(snapshot: TurtleSnapshotLike) {
  if (directionPill) {
    directionPill.textContent = snapshot.mainTimeDirection;
  }
  if (axisPill) {
    axisPill.textContent = snapshot.mainSocialAxis;
  }

  highlightDirection(snapshot.mainTimeDirection);

  if (focusBar) {
    const width = `${Math.round(clampScore(snapshot.focusMomentumScore) * 100)}%`;
    focusBar.style.width = width;
  }
  if (focusLabel) {
    focusLabel.textContent = `focus: ${focusMomentumToBand(snapshot.focusMomentumScore)}`;
  }

  if (depthLabel) {
    depthLabel.textContent = `depth: ${timeWeaveDepthToBand(snapshot.timeWeaveDepthScore)}`;
  }

  if (modeHint) {
    modeHint.textContent = `mode: ${deriveModeHint(snapshot)}`;
  }

  if (metaHint) {
    metaHint.textContent = snapshot.metaHint ?? "";
  }
}

function normalizeDirection(value?: any): TimeDirection {
  if (value === "past" || value === "future" || value === "now") return value;
  if (value === "present") return "now";
  return "now";
}

function normalizeAxis(value?: any): SocialAxis {
  if (value === "self" || value === "family" || value === "world") return value;
  if (value === "collective") return "world";
  return "self";
}

function mapTurtleFrameToOrientation(frameId?: string): { direction: TimeDirection; axis: SocialAxis } {
  switch (frameId) {
    case "deep_time":
      return { direction: "future", axis: "world" };
    case "local_time":
    case "baseline":
    case "regulation_axis":
      return { direction: "now", axis: "self" };
    case "family_field":
      return { direction: "now", axis: "family" };
    case "collective_field":
    case "field_resonance":
      return { direction: "future", axis: "world" };
    case "inner_focus":
      return { direction: "future", axis: "self" };
    default:
      return { direction: "now", axis: "self" };
  }
}

function extractFromTurtlePayload(payload: any): Partial<TurtleSnapshotLike> | undefined {
  if (!payload) return undefined;
  const frameId: string | undefined = payload.currentFrameId || payload.currentFrame || payload.id;
  const { direction, axis } = mapTurtleFrameToOrientation(frameId);
  const commitment = typeof payload.commitment === "number" ? clampScore(payload.commitment) : undefined;
  return {
    mainTimeDirection: direction,
    mainSocialAxis: axis,
    focusMomentumScore: undefined,
    timeWeaveDepthScore: commitment,
  };
}

function extractSnapshot(raw: any): TurtleSnapshotLike | null {
  const payload = raw?.payload ?? raw;
  const orientation =
    payload?.orientation ||
    payload?.temporalOrientation ||
    payload?.temporalOrientationView ||
    payload?.snapshot ||
    payload?.turtleSnapshot ||
    payload;

  const directDirection = normalizeDirection(
    orientation?.mainTimeDirection ?? orientation?.timeDirection ?? orientation?.direction,
  );
  const directAxis = normalizeAxis(orientation?.mainSocialAxis ?? orientation?.socialAxis ?? orientation?.axis);

  const turtleDerived = extractFromTurtlePayload(orientation?.turtle ?? orientation?.rawView?.turtle);

  const metrics =
    orientation?.metrics ||
    orientation?.decision?.metrics ||
    orientation?.rawView?.decision?.metrics ||
    payload?.metrics;

  const depthScore =
    orientation?.timeWeaveDepthScore ??
    metrics?.depthScore ??
    metrics?.timeWeaveDepthScore ??
    (turtleDerived?.timeWeaveDepthScore ?? undefined);

  const focusScore = orientation?.focusMomentumScore ?? metrics?.focusMomentum ?? metrics?.focusMomentumScore;

  const meta = orientation?.metaHint ?? orientation?.hint ?? orientation?.resonanceHint ?? payload?.metaHint;

  const snapshot: TurtleSnapshotLike = {
    mainTimeDirection: turtleDerived?.mainTimeDirection ?? directDirection,
    mainSocialAxis: turtleDerived?.mainSocialAxis ?? directAxis,
    timeWeaveDepthScore: depthScore,
    focusMomentumScore: focusScore,
    metaHint: meta,
  };

  return snapshot;
}

function handleMessage(event: MessageEvent) {
  let parsed: any;
  try {
    parsed = JSON.parse(event.data);
  } catch (error) {
    console.error("Failed to parse WS payload", error);
    return;
  }

  const snapshot = extractSnapshot(parsed);
  if (snapshot) {
    renderOrientation(snapshot);
  }
}

function startWebSocket() {
  updateWsStatus("WS: connecting…");
  const socket = new WebSocket(WS_URL);

  socket.addEventListener("open", () => updateWsStatus("WS: connected", "connected"));
  socket.addEventListener("error", () => updateWsStatus("WS: error", "error"));
  socket.addEventListener("close", () => updateWsStatus("WS: closed"));
  socket.addEventListener("message", handleMessage);
}

function bootstrap() {
  renderOrientation({
    mainTimeDirection: "now",
    mainSocialAxis: "self",
    focusMomentumScore: 0,
    timeWeaveDepthScore: 0,
    metaHint: "waiting for stream…",
  });
  startWebSocket();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  bootstrap();
}

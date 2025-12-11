export type TimeDirection = "past" | "now" | "future";
export type SocialAxis = "self" | "family" | "world";

export type LtpHudStatus = "connecting" | "live" | "disconnected" | "error";

export interface LtpHudState {
  status: LtpHudStatus;
  lastUpdatedAt?: number;
  snapshot?: TurtleSnapshotLike;
  focusMomentum?: number;
}

export const BASELINE_HUD_STATE: LtpHudState = {
  status: "connecting",
  lastUpdatedAt: undefined,
  snapshot: undefined,
  focusMomentum: 0,
};

const FALLBACK_SNAPSHOT: TurtleSnapshotLike = {
  mainTimeDirection: "now",
  mainSocialAxis: "self",
  focusMomentumScore: 0,
  timeWeaveDepthScore: 0,
  metaHint: "waiting for stream…",
};

let hudState: LtpHudState = { ...BASELINE_HUD_STATE };

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

function statusToLabel(status: LtpHudStatus): string {
  switch (status) {
    case "live":
      return "WS: live";
    case "disconnected":
      return "WS: disconnected";
    case "error":
      return "WS: error";
    case "connecting":
    default:
      return "WS: connecting…";
  }
}

function updateWsStatus(status: LtpHudStatus) {
  if (!wsStatus) return;
  wsStatus.textContent = statusToLabel(status);
  wsStatus.classList.toggle("connected", status === "live");
  wsStatus.classList.toggle("error", status === "error");
  wsStatus.classList.toggle("disconnected", status === "disconnected");
  wsStatus.classList.toggle("connecting", status === "connecting");
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

function renderOrientation(snapshot?: TurtleSnapshotLike) {
  const data = snapshot ?? FALLBACK_SNAPSHOT;

  if (directionPill) {
    directionPill.textContent = data.mainTimeDirection;
  }
  if (axisPill) {
    axisPill.textContent = data.mainSocialAxis;
  }

  highlightDirection(data.mainTimeDirection);

  if (focusBar) {
    const width = `${Math.round(clampScore(data.focusMomentumScore) * 100)}%`;
    focusBar.style.width = width;
  }
  if (focusLabel) {
    focusLabel.textContent = `focus: ${focusMomentumToBand(data.focusMomentumScore)}`;
  }

  if (depthLabel) {
    depthLabel.textContent = `depth: ${timeWeaveDepthToBand(data.timeWeaveDepthScore)}`;
  }

  if (modeHint) {
    modeHint.textContent = `mode: ${deriveModeHint(data)}`;
  }

  if (metaHint) {
    metaHint.textContent = data.metaHint ?? "";
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

export function normalizeMessagePayload(raw: any): any {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    return raw[raw.length - 1];
  }
  return raw;
}

export function applySnapshotUpdate(
  prev: LtpHudState,
  incoming: TurtleSnapshotLike | TurtleSnapshotLike[] | null | undefined,
): LtpHudState {
  if (!incoming) return prev;
  if (Array.isArray(incoming)) {
    if (incoming.length === 0) return prev; // Avoid phantom movement on empty batches
    incoming = incoming[incoming.length - 1];
  }

  const nextSnapshot: TurtleSnapshotLike = { ...incoming };
  const focusMomentum = clampScore(incoming.focusMomentumScore ?? prev.focusMomentum ?? 0);

  return {
    status: "live",
    lastUpdatedAt: Date.now(),
    snapshot: nextSnapshot,
    focusMomentum,
  };
}

export function withStatus(prev: LtpHudState, status: LtpHudStatus): LtpHudState {
  if (prev.status === status) return prev;
  return { ...prev, status };
}

function renderHudState(state: LtpHudState) {
  updateWsStatus(state.status);
  const snapshot = state.snapshot ?? { ...FALLBACK_SNAPSHOT, focusMomentumScore: state.focusMomentum ?? 0 };
  renderOrientation(snapshot);
}

function setHudState(next: LtpHudState) {
  const shouldRender = next !== hudState;
  hudState = next;
  if (shouldRender) {
    renderHudState(hudState);
  }
}

function handleMessage(event: MessageEvent) {
  let parsed: any;
  try {
    parsed = JSON.parse(event.data);
  } catch (error) {
    console.error("Failed to parse WS payload", error);
    setHudState(withStatus(hudState, "error"));
    return;
  }

  const normalized = normalizeMessagePayload(parsed);
  const snapshot = normalized ? extractSnapshot(normalized) : null;
  const nextState = applySnapshotUpdate(hudState, snapshot);
  setHudState(nextState);
}

function startWebSocket() {
  setHudState(withStatus(hudState, "connecting"));
  const socket = new WebSocket(WS_URL);

  socket.addEventListener("open", () => setHudState(withStatus(hudState, "connecting")));
  socket.addEventListener("error", () => setHudState(withStatus(hudState, "error")));
  socket.addEventListener("close", () => setHudState(withStatus(hudState, "disconnected")));
  socket.addEventListener("message", handleMessage);
}

function bootstrap() {
  renderHudState(hudState);
  startWebSocket();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  bootstrap();
}

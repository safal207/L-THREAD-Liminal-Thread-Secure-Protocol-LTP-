export type FrameType =
  | "hello"
  | "heartbeat"
  | "orientation"
  | "route_request"
  | "route_response"
  | "focus_snapshot";

export interface BaseFrame {
  v: "0.1";
  id: string;
  ts: number;
  type: FrameType;
  payload: unknown;
}

export interface HelloPayload {
  role: "client" | "server";
  message: string;
}

export interface HeartbeatPayload {
  seq: number;
  status?: string;
}

export interface OrientationPayload {
  origin: string;
  destination: string;
  mode: string;
}

export interface RouteRequestPayload {
  goal: string;
  context?: string[];
}

export interface RouteBranch {
  path: string[];
  confidence: number;
  rationale?: string;
}

export type RouteBranchMap = Record<string, RouteBranch>;

export interface RouteResponsePayload {
  branches: RouteBranch[] | RouteBranchMap;
  selection?: string;
}

export interface FocusSnapshotPayload {
  focus: string;
  signal: number;
  rationale?: string;
}

export type LTPFrame =
  | (BaseFrame & { type: "hello"; payload: HelloPayload })
  | (BaseFrame & { type: "heartbeat"; payload: HeartbeatPayload })
  | (BaseFrame & { type: "orientation"; payload: OrientationPayload })
  | (BaseFrame & { type: "route_request"; payload: RouteRequestPayload })
  | (BaseFrame & { type: "route_response"; payload: RouteResponsePayload })
  | (BaseFrame & { type: "focus_snapshot"; payload: FocusSnapshotPayload });

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isNumber = (value: unknown): value is number => typeof value === "number";

const isHelloPayload = (payload: unknown): payload is HelloPayload => {
  if (!isObject(payload)) return false;
  return (
    (payload.role === "client" || payload.role === "server") &&
    typeof payload.message === "string" &&
    payload.message.length > 0
  );
};

const isHeartbeatPayload = (payload: unknown): payload is HeartbeatPayload => {
  if (!isObject(payload)) return false;
  if (!isNumber(payload.seq)) return false;
  if ("status" in payload && typeof payload.status !== "string") return false;
  return payload.seq >= 0;
};

const isOrientationPayload = (payload: unknown): payload is OrientationPayload => {
  if (!isObject(payload)) return false;
  return (
    typeof payload.origin === "string" &&
    typeof payload.destination === "string" &&
    typeof payload.mode === "string"
  );
};

const isRouteBranch = (value: unknown): value is RouteBranch => {
  if (!isObject(value)) return false;
  if (!isStringArray(value.path) || value.path.length === 0) return false;
  if (!isNumber(value.confidence)) return false;
  if (value.confidence < 0 || value.confidence > 1) return false;
  if ("rationale" in value && typeof value.rationale !== "string") return false;
  return true;
};

const isRouteResponsePayload = (
  payload: unknown
): payload is RouteResponsePayload => {
  if (!isObject(payload)) return false;
  const { branches } = payload as { branches?: unknown };
  const hasArrayBranches =
    Array.isArray(branches) && branches.every((branch) => isRouteBranch(branch));
  const hasMapBranches =
    isObject(branches) &&
    Object.values(branches as Record<string, unknown>).every((branch) => isRouteBranch(branch));

  if (!hasArrayBranches && !hasMapBranches) {
    return false;
  }

  if ("selection" in payload && payload.selection !== undefined) {
    if (typeof payload.selection !== "string") return false;
  }

  return true;
};

const isRouteRequestPayload = (
  payload: unknown
): payload is RouteRequestPayload => {
  if (!isObject(payload)) return false;
  const hasValidContext =
    payload.context === undefined || isStringArray(payload.context);
  return typeof payload.goal === "string" && hasValidContext;
};

const isFocusSnapshotPayload = (
  payload: unknown
): payload is FocusSnapshotPayload => {
  if (!isObject(payload)) return false;
  if (typeof payload.focus !== "string" || !isNumber(payload.signal)) return false;
  if (payload.signal < 0 || payload.signal > 1) return false;
  if ("rationale" in payload && typeof payload.rationale !== "string") return false;
  return true;
};

export const isLTPFrame = (frame: unknown): frame is LTPFrame => {
  if (!isObject(frame)) return false;
  if (frame.v !== "0.1") return false;
  if (typeof frame.id !== "string" || frame.id.length === 0) return false;
  if (!isNumber(frame.ts)) return false;
  if (typeof frame.type !== "string") return false;
  if (!("payload" in frame)) return false;

  switch (frame.type) {
    case "hello":
      return isHelloPayload(frame.payload);
    case "heartbeat":
      return isHeartbeatPayload(frame.payload);
    case "orientation":
      return isOrientationPayload(frame.payload);
    case "route_request":
      return isRouteRequestPayload(frame.payload);
    case "route_response":
      return isRouteResponsePayload(frame.payload);
    case "focus_snapshot":
      return isFocusSnapshotPayload(frame.payload);
    default:
      return false;
  }
};

export const validateFrameOrThrow = (frame: unknown): asserts frame is LTPFrame => {
  if (!isLTPFrame(frame)) {
    throw new Error("Invalid LTP frame");
  }
};

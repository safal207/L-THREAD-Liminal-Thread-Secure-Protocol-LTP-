export const LTP_VERSION = "0.1" as const;

export const FRAME_TYPES_V0_1 = [
  "hello",
  "heartbeat",
  "orientation",
  "route_request",
  "route_response",
  "focus_snapshot",
] as const;

export type FrameTypeV0_1 = (typeof FRAME_TYPES_V0_1)[number];

export const isKnownFrameType = (type: string): type is FrameTypeV0_1 =>
  (FRAME_TYPES_V0_1 as readonly string[]).includes(type);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const assertFrameV0_1 = (
  frame: unknown,
): { ok: true } | { ok: false; errors: string[] } => {
  const errors: string[] = [];

  if (!isObject(frame)) {
    return { ok: false, errors: ["frame must be an object"] };
  }

  if (frame.v !== LTP_VERSION) {
    errors.push(`version must be ${LTP_VERSION}`);
  }

  if (typeof frame.id !== "string" || frame.id.trim().length === 0) {
    errors.push("id must be a non-empty string");
  }

  if (typeof frame.ts !== "number" || Number.isNaN(frame.ts)) {
    errors.push("ts must be a number");
  }

  if (typeof frame.type !== "string") {
    errors.push("type must be a string");
  } else if (!isKnownFrameType(frame.type)) {
    errors.push(`type must be one of: ${FRAME_TYPES_V0_1.join(", ")}`);
  }

  if (!("payload" in frame)) {
    errors.push("payload is required");
  } else if (!isObject((frame as { payload: unknown }).payload)) {
    errors.push("payload must be an object");
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
};

export type NormalizedRouteBranch = { name: string; confidence: number; path: string[]; rationale?: string };

export const normalizeRouteBranches = (
  branches: unknown,
): NormalizedRouteBranch[] => {
  if (!branches) return [];

  if (Array.isArray(branches)) {
    return branches
      .filter((branch): branch is { path: string[]; confidence: number; rationale?: string } =>
        isObject(branch) && Array.isArray(branch.path) && typeof branch.confidence === "number",
      )
      .map((branch, index) => ({
        name: branch.path[0] ?? `branch-${index + 1}`,
        confidence: branch.confidence,
        path: branch.path,
        rationale: branch.rationale,
      }));
  }

  if (isObject(branches)) {
    return Object.entries(branches)
      .filter(([, branch]) =>
        isObject(branch) && Array.isArray((branch as { path?: unknown }).path) && typeof branch.confidence === "number",
      )
      .map(([name, branch]) => ({
        name,
        confidence: (branch as { confidence: number }).confidence,
        path: (branch as { path: string[] }).path,
        rationale: (branch as { rationale?: string }).rationale,
      }));
  }

  return [];
};

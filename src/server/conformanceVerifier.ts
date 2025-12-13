import { FrameType, isLTPFrame } from "../../sdk/js/src/frames/frameSchema";

export interface VerificationResult {
  ok: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  passed: string[];
  hints: string[];
}

export interface ConformanceVerifyRequest {
  frames: unknown;
}

export interface ConformanceVerifyResponse extends VerificationResult {
  annotations: string[];
  frameCount: number;
}

interface MinimalFrameShape {
  v?: unknown;
  id?: unknown;
  ts?: unknown;
  type?: unknown;
  payload?: unknown;
  from?: unknown;
  to?: unknown;
}

const knownTypes: FrameType[] = [
  "hello",
  "heartbeat",
  "orientation",
  "route_request",
  "route_response",
  "focus_snapshot",
];

const isNonDecreasing = (current: number, previous: number | undefined): boolean => {
  if (previous === undefined) return true;
  return current >= previous;
};

const clampScore = (value: number): number => {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number(value.toFixed(3));
};

interface VerificationMeta {
  httpStatus: number;
  annotations: string[];
  semanticError: boolean;
}

const addAnnotation = (annotations: string[], level: "info" | "warning" | "error", message: string) => {
  annotations.push(`${level.toUpperCase()}: ${message}`);
};

const validateFrameShape = (frame: unknown, index: number, annotations: string[]): MinimalFrameShape | null => {
  if (frame === null || typeof frame !== "object") {
    addAnnotation(annotations, "error", `frame ${index} is not an object`);
    return null;
  }

  const shape = frame as MinimalFrameShape;
  const missing: string[] = [];
  if (shape.v === undefined) missing.push("v");
  if (shape.id === undefined) missing.push("id");
  if (shape.ts === undefined) missing.push("ts");
  if (shape.type === undefined) missing.push("type");
  if (shape.payload === undefined) missing.push("payload");

  if (missing.length > 0) {
    addAnnotation(
      annotations,
      "error",
      `frame ${index} is missing required fields: ${missing.join(", ")}`,
    );
  }

  return shape;
};

export function verifyConformance(inputFrames: unknown): ConformanceVerifyResponse & VerificationMeta {
  const result: ConformanceVerifyResponse = {
    ok: true,
    score: 1,
    errors: [],
    warnings: [],
    passed: [],
    hints: [],
    annotations: [],
    frameCount: 0,
  };

  const meta: VerificationMeta = {
    httpStatus: 200,
    annotations: result.annotations,
    semanticError: false,
  };

  if (!Array.isArray(inputFrames)) {
    result.ok = false;
    result.score = 0;
    result.errors.push("frames must be an array");
    meta.httpStatus = 400;
    addAnnotation(meta.annotations, "error", "payload.frames must be an array");
    return { ...result, ...meta };
  }

  const frames = inputFrames as MinimalFrameShape[];
  result.frameCount = frames.length;

  if (frames.length === 0) {
    result.ok = false;
    result.score = 0;
    result.errors.push("at least one frame is required and must start with hello");
    result.hints.push("send a hello frame first to establish the session");
    meta.httpStatus = 400;
    addAnnotation(meta.annotations, "error", "empty frame list is invalid");
    return { ...result, ...meta };
  }

  const MAX_FRAMES = 5000;
  if (frames.length > MAX_FRAMES) {
    result.ok = false;
    result.score = 0;
    const error = `frame count exceeds maximum of ${MAX_FRAMES}`;
    result.errors.push(error);
    meta.httpStatus = 413;
    addAnnotation(meta.annotations, "error", error);
    return { ...result, ...meta };
  }

  let lastTimestamp: number | undefined;
  const seenIdsBySender = new Map<string, Set<string>>();

  frames.forEach((frame, index) => {
    const validated = validateFrameShape(frame, index, meta.annotations);
    const sender = typeof validated?.from === "string" ? validated.from : "global";
    const senderIds = seenIdsBySender.get(sender) ?? new Set<string>();

    if (typeof validated?.id === "string") {
      if (senderIds.has(validated.id)) {
        const warning = `duplicate frame id detected for sender ${sender}: ${validated.id} (index ${index})`;
        result.warnings.push(warning);
        addAnnotation(meta.annotations, "warning", warning);
      }
      senderIds.add(validated.id);
      seenIdsBySender.set(sender, senderIds);
    } else {
      const error = `frame ${index} is missing a valid id`;
      result.errors.push(error);
      addAnnotation(meta.annotations, "error", error);
    }

    if (index === 0) {
      if (validated?.type !== "hello") {
        const message = "first frame must be a hello frame";
        result.errors.push(message);
        result.hints.push("prepend a hello frame to initiate the session chain");
        addAnnotation(meta.annotations, "error", message);
        meta.semanticError = true;
      } else {
        const message = "hello frame initiates the session";
        result.passed.push(message);
        addAnnotation(meta.annotations, "info", message);
      }
    }

    if (validated?.v !== "0.1") {
      const error = `frame ${index} has unsupported version: ${String(validated?.v)}`;
      result.errors.push(error);
      addAnnotation(meta.annotations, "error", error);
    }

    if (typeof validated?.ts === "number") {
      if (!isNonDecreasing(validated.ts, lastTimestamp)) {
        const warning = `frame ${index} timestamp is earlier than previous frame`;
        result.warnings.push(warning);
        addAnnotation(meta.annotations, "warning", warning);
        meta.semanticError = true;
      }
      lastTimestamp = validated.ts;
    } else {
      const error = `frame ${index} is missing a numeric timestamp`;
      result.errors.push(error);
      addAnnotation(meta.annotations, "error", error);
    }

    const typeValue = validated?.type;
    const isKnownType = typeof typeValue === "string" && knownTypes.includes(typeValue as FrameType);
    if (!isKnownType) {
      if (typeof typeValue === "string") {
        const warning = `frame ${index} has unknown type: ${typeValue}`;
        result.warnings.push(warning);
        addAnnotation(meta.annotations, "warning", warning);
      } else {
        const error = `frame ${index} is missing a valid type`;
        result.errors.push(error);
        addAnnotation(meta.annotations, "error", error);
      }
    }

    if (isKnownType) {
      const validShape = isLTPFrame(validated);
      if (validShape) {
        const message = `frame ${index} passed structural validation (${typeValue})`;
        result.passed.push(message);
        addAnnotation(meta.annotations, "info", message);
      } else {
        const error = `frame ${index} failed schema validation for type ${typeValue}`;
        result.errors.push(error);
        addAnnotation(meta.annotations, "error", error);
      }
    }
  });

  const errorPenalty = result.errors.length * 0.25;
  const warningPenalty = result.warnings.length * 0.05;
  const rawScore = 1 - errorPenalty - warningPenalty;

  result.ok = result.errors.length === 0;
  result.score = clampScore(rawScore);

  if (result.warnings.length > 0) {
    const hint = "address warnings to improve conformance score";
    result.hints.push(hint);
    addAnnotation(meta.annotations, "info", hint);
  }

  if (!result.ok && meta.semanticError && meta.httpStatus === 200) {
    meta.httpStatus = 422;
  }

  if (!result.ok && meta.httpStatus === 200) {
    meta.httpStatus = 400;
  }

  return { ...result, ...meta };
}

import { FrameType, isLTPFrame } from "../../sdk/js/src/frames/frameSchema";

export interface VerificationResult {
  ok: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  passed: string[];
  hints: string[];
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

export function verifyConformance(inputFrames: unknown): VerificationResult {
  const result: VerificationResult = {
    ok: true,
    score: 1,
    errors: [],
    warnings: [],
    passed: [],
    hints: [],
  };

  if (!Array.isArray(inputFrames)) {
    result.ok = false;
    result.score = 0;
    result.errors.push("frames must be an array");
    return result;
  }

  const frames = inputFrames as MinimalFrameShape[];
  if (frames.length === 0) {
    result.ok = false;
    result.score = 0;
    result.errors.push("at least one frame is required and must start with hello");
    result.hints.push("send a hello frame first to establish the session");
    return result;
  }

  let lastTimestamp: number | undefined;
  const seenIdsBySender = new Map<string, Set<string>>();

  frames.forEach((frame, index) => {
    const sender = typeof frame.from === "string" ? frame.from : "global";
    const senderIds = seenIdsBySender.get(sender) ?? new Set<string>();

    if (typeof frame.id === "string") {
      if (senderIds.has(frame.id)) {
        result.warnings.push(
          `duplicate frame id detected for sender ${sender}: ${frame.id} (index ${index})`,
        );
      }
      senderIds.add(frame.id);
      seenIdsBySender.set(sender, senderIds);
    } else {
      result.errors.push(`frame ${index} is missing a valid id`);
    }

    if (index === 0) {
      if (frame.type !== "hello") {
        result.errors.push("first frame must be a hello frame");
        result.hints.push("prepend a hello frame to initiate the session chain");
      } else {
        result.passed.push("hello frame initiates the session");
      }
    }

    if (frame.v !== "0.1") {
      result.errors.push(`frame ${index} has unsupported version: ${String(frame.v)}`);
    }

    if (typeof frame.ts === "number") {
      if (!isNonDecreasing(frame.ts, lastTimestamp)) {
        result.warnings.push(`frame ${index} timestamp is earlier than previous frame`);
      }
      lastTimestamp = frame.ts;
    } else {
      result.errors.push(`frame ${index} is missing a numeric timestamp`);
    }

    const typeValue = frame.type;
    const isKnownType = typeof typeValue === "string" && knownTypes.includes(typeValue as FrameType);
    if (!isKnownType) {
      if (typeof typeValue === "string") {
        result.warnings.push(`frame ${index} has unknown type: ${typeValue}`);
      } else {
        result.errors.push(`frame ${index} is missing a valid type`);
      }
    }

    if (isKnownType) {
      const validShape = isLTPFrame(frame);
      if (validShape) {
        result.passed.push(`frame ${index} passed structural validation (${typeValue})`);
      } else {
        result.errors.push(`frame ${index} failed schema validation for type ${typeValue}`);
      }
    }
  });

  const errorPenalty = result.errors.length * 0.25;
  const warningPenalty = result.warnings.length * 0.05;
  const rawScore = 1 - errorPenalty - warningPenalty;

  result.ok = result.errors.length === 0;
  result.score = clampScore(rawScore);

  if (result.warnings.length > 0) {
    result.hints.push("address warnings to improve conformance score");
  }

  return result;
}

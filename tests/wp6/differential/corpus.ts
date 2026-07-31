import { createHash } from "node:crypto";
import { DeterministicRng } from "../../../tools/adversarial/prng";

export const CORPUS_PROFILE = "org.ltp.wp6.four-sdk-corpus.v1";
export const DEFAULT_SEED = 0x1a2b3c4d;
export const DEFAULT_CASES = 512;
export const MAX_INPUT_BYTES = 65_536;
export const MAX_DEPTH = 32;

export type ExpectedVerdict = "ACCEPTED" | "REJECTED";
export type ExpectedReason =
  | "ACCEPTED"
  | "INVALID_JSON"
  | "INPUT_TOO_LARGE"
  | "MAX_DEPTH_EXCEEDED"
  | "CANONICAL_REJECTED";

export interface DifferentialCase {
  id: string;
  category: string;
  raw_json: string;
  expected_verdict: ExpectedVerdict;
  expected_reason: ExpectedReason;
}

export interface DifferentialCorpus {
  schema_version: 1;
  profile: typeof CORPUS_PROFILE;
  seed: number;
  requested_cases: number;
  limits: {
    max_input_bytes: number;
    max_depth: number;
  };
  cases: DifferentialCase[];
  corpus_digest: string;
}

const UNICODE_KEYS = ["a", "Z", "é", "漢", "😀", "𝄞", "\ue000", "\u000f"] as const;
const STRING_VALUES = ["", "plain", "café", "漢字", "emoji-😀", "line\nbreak", "quote-\""] as const;

function envelope(payload: unknown, index: number): Record<string, unknown> {
  return {
    type: "state_update",
    thread_id: `wp6-thread-${index}`,
    session_id: `wp6-session-${index % 17}`,
    timestamp: 1_700_000_000_000 + index,
    nonce: `hmac-${index.toString(16).padStart(32, "0")}-${1_700_000_000_000 + index}`,
    payload,
    prev_message_hash: index === 0 ? "" : "a".repeat(64),
    meta: { source: "wp6-differential", index },
    content_encoding: "json",
  };
}

function randomString(rng: DeterministicRng): string {
  const base = rng.pick(STRING_VALUES);
  return `${base}${rng.int(4) === 0 ? `-${rng.nextU32().toString(16)}` : ""}`;
}

function randomValue(rng: DeterministicRng, depth = 0): unknown {
  if (depth >= 5) {
    return rng.pick([null, true, false, rng.int(1_000_000), randomString(rng)] as const);
  }

  switch (rng.int(7)) {
    case 0:
      return null;
    case 1:
      return rng.int(2) === 0;
    case 2:
      return rng.int(2_000_000) - 1_000_000;
    case 3:
      return randomString(rng);
    case 4:
      return Array.from({ length: rng.int(5) }, () => randomValue(rng, depth + 1));
    default: {
      const result: Record<string, unknown> = {};
      const count = 1 + rng.int(5);
      for (let index = 0; index < count; index += 1) {
        const key = `${rng.pick(UNICODE_KEYS)}-${depth}-${index}-${rng.int(97)}`;
        result[key] = randomValue(rng, depth + 1);
      }
      return result;
    }
  }
}

function deepPayload(depth: number): unknown {
  let current: unknown = "leaf";
  for (let index = 0; index < depth; index += 1) current = [current];
  return current;
}

function compact(value: unknown): string {
  return JSON.stringify(value);
}

function fixedCases(): DifferentialCase[] {
  return [
    {
      id: "fixed-empty",
      category: "valid-empty",
      raw_json: compact(envelope({}, 0)),
      expected_verdict: "ACCEPTED",
      expected_reason: "ACCEPTED",
    },
    {
      id: "fixed-unicode-order",
      category: "valid-unicode-order",
      raw_json: compact(envelope({ "😀": 1, "𝄞": 2, "é": 3, a: 4, "漢": 5 }, 1)),
      expected_verdict: "ACCEPTED",
      expected_reason: "ACCEPTED",
    },
    {
      id: "fixed-number-boundaries",
      category: "valid-number-boundaries",
      raw_json: compact(envelope({
        small: 1e-7,
        fixed: 1e-6,
        safe_max: 9_007_199_254_740_991,
        negative_zero: -0,
      }, 2)),
      expected_verdict: "ACCEPTED",
      expected_reason: "ACCEPTED",
    },
    {
      id: "fixed-unsafe-integer",
      category: "invalid-unsafe-integer",
      raw_json: compact(envelope({ unsafe: 9_007_199_254_740_992 }, 3)),
      expected_verdict: "REJECTED",
      expected_reason: "CANONICAL_REJECTED",
    },
    {
      id: "fixed-malformed-json",
      category: "invalid-json",
      raw_json: "{\"type\":\"state_update\",\"payload\":",
      expected_verdict: "REJECTED",
      expected_reason: "INVALID_JSON",
    },
    {
      id: "fixed-depth-limit",
      category: "invalid-depth",
      raw_json: compact(envelope(deepPayload(MAX_DEPTH + 8), 5)),
      expected_verdict: "REJECTED",
      expected_reason: "MAX_DEPTH_EXCEEDED",
    },
    {
      id: "fixed-size-limit",
      category: "invalid-size",
      raw_json: compact(envelope({ blob: "x".repeat(MAX_INPUT_BYTES + 1_024) }, 6)),
      expected_verdict: "REJECTED",
      expected_reason: "INPUT_TOO_LARGE",
    },
  ];
}

function generatedCase(rng: DeterministicRng, index: number): DifferentialCase {
  const category = index % 23;
  if (category === 0) {
    return {
      id: `generated-${index}`,
      category: "invalid-json",
      raw_json: `{"type":"state_update","index":${index}`,
      expected_verdict: "REJECTED",
      expected_reason: "INVALID_JSON",
    };
  }
  if (category === 1) {
    return {
      id: `generated-${index}`,
      category: "invalid-unsafe-integer",
      raw_json: compact(envelope({ unsafe: 9_007_199_254_740_992 }, index)),
      expected_verdict: "REJECTED",
      expected_reason: "CANONICAL_REJECTED",
    };
  }
  if (category === 2) {
    return {
      id: `generated-${index}`,
      category: "invalid-depth",
      raw_json: compact(envelope(deepPayload(MAX_DEPTH + 1 + rng.int(12)), index)),
      expected_verdict: "REJECTED",
      expected_reason: "MAX_DEPTH_EXCEEDED",
    };
  }

  return {
    id: `generated-${index}`,
    category: "valid-generated",
    raw_json: compact(envelope(randomValue(rng), index)),
    expected_verdict: "ACCEPTED",
    expected_reason: "ACCEPTED",
  };
}

export function generateCorpus(seed = DEFAULT_SEED, requestedCases = DEFAULT_CASES): DifferentialCorpus {
  if (!Number.isInteger(requestedCases) || requestedCases < 16) {
    throw new Error("requestedCases must be an integer >= 16");
  }
  const rng = new DeterministicRng(seed);
  const cases = fixedCases();
  for (let index = cases.length; index < requestedCases; index += 1) {
    cases.push(generatedCase(rng, index));
  }
  const digestInput = JSON.stringify({ seed: seed >>> 0, limits: [MAX_INPUT_BYTES, MAX_DEPTH], cases });
  return {
    schema_version: 1,
    profile: CORPUS_PROFILE,
    seed: seed >>> 0,
    requested_cases: requestedCases,
    limits: { max_input_bytes: MAX_INPUT_BYTES, max_depth: MAX_DEPTH },
    cases,
    corpus_digest: createHash("sha256").update(digestInput).digest("hex"),
  };
}

import { createHash } from "node:crypto";
import { DifferentialCase, DifferentialCorpus, ExpectedReason, ExpectedVerdict } from "./corpus";

export interface AdapterCaseResult {
  id: string;
  category: string;
  verdict: ExpectedVerdict;
  reason: ExpectedReason;
  canonical_digest?: string;
}

export interface AdapterReport {
  schema_version: 1;
  profile: "org.ltp.wp6.sdk-differential-report.v1";
  sdk: "reference" | "javascript" | "python" | "rust" | "elixir";
  corpus_digest: string;
  limits: DifferentialCorpus["limits"];
  results: AdapterCaseResult[];
}

function valueDepth(value: unknown, depth = 0): number {
  if (value === null || typeof value !== "object") return depth;
  if (Array.isArray(value)) {
    return value.reduce((maximum, item) => Math.max(maximum, valueDepth(item, depth + 1)), depth + 1);
  }
  return Object.values(value as Record<string, unknown>)
    .reduce((maximum, item) => Math.max(maximum, valueDepth(item, depth + 1)), depth + 1);
}

export function classifyCase(
  entry: DifferentialCase,
  limits: DifferentialCorpus["limits"],
  serialize: (value: Record<string, unknown>) => string,
): AdapterCaseResult {
  if (Buffer.byteLength(entry.raw_json, "utf8") > limits.max_input_bytes) {
    return { id: entry.id, category: entry.category, verdict: "REJECTED", reason: "INPUT_TOO_LARGE" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(entry.raw_json);
  } catch {
    return { id: entry.id, category: entry.category, verdict: "REJECTED", reason: "INVALID_JSON" };
  }

  if (valueDepth(parsed) > limits.max_depth) {
    return { id: entry.id, category: entry.category, verdict: "REJECTED", reason: "MAX_DEPTH_EXCEEDED" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { id: entry.id, category: entry.category, verdict: "REJECTED", reason: "CANONICAL_REJECTED" };
  }

  try {
    const canonical = serialize(parsed as Record<string, unknown>);
    return {
      id: entry.id,
      category: entry.category,
      verdict: "ACCEPTED",
      reason: "ACCEPTED",
      canonical_digest: createHash("sha256").update(canonical, "utf8").digest("hex"),
    };
  } catch {
    return { id: entry.id, category: entry.category, verdict: "REJECTED", reason: "CANONICAL_REJECTED" };
  }
}

export function buildReport(
  sdk: AdapterReport["sdk"],
  corpus: DifferentialCorpus,
  serialize: (value: Record<string, unknown>) => string,
): AdapterReport {
  return {
    schema_version: 1,
    profile: "org.ltp.wp6.sdk-differential-report.v1",
    sdk,
    corpus_digest: corpus.corpus_digest,
    limits: corpus.limits,
    results: corpus.cases.map((entry) => classifyCase(entry, corpus.limits, serialize)),
  };
}

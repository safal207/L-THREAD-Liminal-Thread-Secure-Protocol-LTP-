import { createHash } from "node:crypto";
import { NegotiationInput, ReasonCode } from "../versioning/negotiation-types";
import { Registry, VersionProfile } from "../versioning/registry-types";
import { negotiate } from "../versioning/negotiation";
import { DeterministicRng } from "./prng";
import { encodeWireEnvelope, validateWireFrame, WireReason } from "./wire";

export interface CampaignOutcome {
  id: string;
  domain: "negotiation" | "wire";
  category: string;
  expected_reason: ReasonCode | WireReason;
  actual_reason: ReasonCode | WireReason;
  deterministic: boolean;
  state_unchanged_on_reject: boolean;
  passed: boolean;
}

export interface FuzzCampaignReport {
  profile: "org.ltp.wp6.adversarial-fuzz.v1";
  seed: number;
  cases: number;
  passed: number;
  rejected: number;
  accepted: number;
  invariant_failures: number;
  categories: Record<string, number>;
  outcomes_digest: string;
  outcomes: CampaignOutcome[];
}

const NEGOTIATION_CATEGORIES = [
  "valid-current",
  "invalid-version",
  "unknown-required",
  "missing-required",
  "downgrade",
  "unsupported-version",
  "incompatible-resume",
] as const;

const WIRE_CATEGORIES = [
  "valid-envelope",
  "empty-frame",
  "invalid-utf8",
  "truncated-json",
  "unknown-opcode",
  "oversized-frame",
  "invalid-version",
  "invalid-hash",
  "invalid-nonce",
] as const;

function wireProfiles(registry: Registry): VersionProfile[] {
  return registry.versions.filter((profile) => profile.wire_supported);
}

function currentProfile(registry: Registry): VersionProfile {
  const profiles = wireProfiles(registry);
  const current = profiles.find((profile) => profile.status === "current") ?? profiles.at(-1);
  if (!current) throw new Error("registry has no wire-supported profile");
  return current;
}

function legacyProfile(registry: Registry): VersionProfile {
  const legacy = wireProfiles(registry).find((profile) => profile.status === "legacy");
  if (!legacy) throw new Error("registry has no legacy profile");
  return legacy;
}

function validInput(profile: VersionProfile): NegotiationInput {
  return {
    client_versions: [profile.version],
    client_capabilities: [...profile.required_capabilities, ...profile.optional_capabilities],
  };
}

function negotiationCase(
  registry: Registry,
  rng: DeterministicRng,
  category: typeof NEGOTIATION_CATEGORIES[number],
): { input: NegotiationInput; expected: ReasonCode } {
  const current = currentProfile(registry);
  const legacy = legacyProfile(registry);
  const input = validInput(current);

  switch (category) {
    case "valid-current":
      return { input, expected: "NEGOTIATED" };
    case "invalid-version":
      return { input: { ...input, client_versions: ["0.6"] }, expected: "INVALID_VERSION" };
    case "unknown-required":
      return {
        input: { ...input, required_capabilities: [rng.token("unknown-required")] },
        expected: "UNKNOWN_REQUIRED_CAPABILITY",
      };
    case "missing-required": {
      const omitted = rng.pick(current.required_capabilities);
      return {
        input: { ...input, client_capabilities: input.client_capabilities.filter((item) => item !== omitted) },
        expected: "MISSING_REQUIRED_CAPABILITY",
      };
    }
    case "downgrade":
      return {
        input: { ...validInput(legacy), minimum_version: current.version },
        expected: "DOWNGRADE_BLOCKED",
      };
    case "unsupported-version":
      return { input: { ...input, client_versions: ["9.9.9"] }, expected: "UNSUPPORTED_VERSION" };
    case "incompatible-resume":
      return {
        input: {
          ...input,
          prior_session: {
            protocol_version: current.version,
            snapshot_schema: current.snapshot_schema + 100 + rng.int(100),
            canonical_envelope: current.canonical_envelope,
          },
        },
        expected: "INCOMPATIBLE_STATE_VERSION",
      };
  }
}

function validEnvelope(rng: DeterministicRng): Record<string, unknown> {
  return {
    opcode: "message",
    protocol_version: "0.6.0",
    previous_hash: "a".repeat(64),
    nonce: rng.token("nonce"),
    payload: { value: rng.nextU32() },
  };
}

function wireCase(
  rng: DeterministicRng,
  category: typeof WIRE_CATEGORIES[number],
): { frame: Uint8Array; expected: WireReason; maxBytes?: number } {
  const envelope = validEnvelope(rng);
  switch (category) {
    case "valid-envelope":
      return { frame: encodeWireEnvelope(envelope), expected: "ACCEPTED" };
    case "empty-frame":
      return { frame: new Uint8Array(), expected: "EMPTY_FRAME" };
    case "invalid-utf8":
      return { frame: new Uint8Array([0xc3, 0x28]), expected: "INVALID_UTF8" };
    case "truncated-json":
      return { frame: new TextEncoder().encode('{"opcode":"message"'), expected: "INVALID_JSON" };
    case "unknown-opcode":
      return { frame: encodeWireEnvelope({ ...envelope, opcode: rng.token("unknown") }), expected: "UNKNOWN_OPCODE" };
    case "oversized-frame":
      return { frame: new Uint8Array(257), expected: "OVERSIZED_FRAME", maxBytes: 256 };
    case "invalid-version":
      return { frame: encodeWireEnvelope({ ...envelope, protocol_version: "latest" }), expected: "INVALID_VERSION" };
    case "invalid-hash":
      return { frame: encodeWireEnvelope({ ...envelope, previous_hash: rng.token("bad-hash") }), expected: "INVALID_HASH" };
    case "invalid-nonce":
      return { frame: encodeWireEnvelope({ ...envelope, nonce: "x" }), expected: "INVALID_NONCE" };
  }
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function runFuzzCampaign(registry: Registry, seed: number, cases: number): FuzzCampaignReport {
  if (!Number.isInteger(cases) || cases <= 0) throw new Error("cases must be a positive integer");
  const rng = new DeterministicRng(seed);
  const outcomes: CampaignOutcome[] = [];
  const categories: Record<string, number> = {};

  for (let index = 0; index < cases; index += 1) {
    if (index % 2 === 0) {
      const category = NEGOTIATION_CATEGORIES[rng.int(NEGOTIATION_CATEGORIES.length)];
      const generated = negotiationCase(registry, rng, category);
      const before = JSON.stringify(registry);
      const first = negotiate(registry, generated.input);
      const second = negotiate(registry, generated.input);
      const actual = first.reason_code;
      const deterministic = JSON.stringify(first) === JSON.stringify(second);
      const rejected = !first.ok;
      const stateUnchanged = !rejected || before === JSON.stringify(registry);
      const passed = actual === generated.expected && deterministic && stateUnchanged;
      categories[`negotiation:${category}`] = (categories[`negotiation:${category}`] ?? 0) + 1;
      outcomes.push({
        id: `negotiation-${index}`,
        domain: "negotiation",
        category,
        expected_reason: generated.expected,
        actual_reason: actual,
        deterministic,
        state_unchanged_on_reject: stateUnchanged,
        passed,
      });
    } else {
      const category = WIRE_CATEGORIES[rng.int(WIRE_CATEGORIES.length)];
      const generated = wireCase(rng, category);
      const first = validateWireFrame(generated.frame, generated.maxBytes);
      const second = validateWireFrame(generated.frame, generated.maxBytes);
      const deterministic = JSON.stringify(first) === JSON.stringify(second);
      const stateUnchanged = first.ok || !first.state_mutation_allowed;
      const passed = first.reason_code === generated.expected && deterministic && stateUnchanged;
      categories[`wire:${category}`] = (categories[`wire:${category}`] ?? 0) + 1;
      outcomes.push({
        id: `wire-${index}`,
        domain: "wire",
        category,
        expected_reason: generated.expected,
        actual_reason: first.reason_code,
        deterministic,
        state_unchanged_on_reject: stateUnchanged,
        passed,
      });
    }
  }

  const invariantFailures = outcomes.filter((outcome) => !outcome.passed).length;
  const accepted = outcomes.filter((outcome) => outcome.actual_reason === "NEGOTIATED" || outcome.actual_reason === "ACCEPTED").length;
  return {
    profile: "org.ltp.wp6.adversarial-fuzz.v1",
    seed: seed >>> 0,
    cases,
    passed: cases - invariantFailures,
    rejected: cases - accepted,
    accepted,
    invariant_failures: invariantFailures,
    categories,
    outcomes_digest: digest(outcomes),
    outcomes,
  };
}

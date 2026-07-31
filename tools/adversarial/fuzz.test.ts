import { describe, expect, it } from "vitest";
import { loadRegistry } from "../versioning/registry";
import { runFuzzCampaign } from "./fuzz";

const SEED = 0x00c0ffee;

describe("WP6 deterministic adversarial fuzzing", () => {
  it("reproduces the same outcomes for the same seed", () => {
    const registry = loadRegistry();
    const first = runFuzzCampaign(registry, SEED, 1000);
    const second = runFuzzCampaign(registry, SEED, 1000);

    expect(first.outcomes_digest).toBe(second.outcomes_digest);
    expect(first.categories).toEqual(second.categories);
    expect(first.invariant_failures).toBe(0);
    expect(first.passed).toBe(1000);
  });

  it("covers negotiation and malformed-wire rejection paths", () => {
    const report = runFuzzCampaign(loadRegistry(), SEED, 2000);
    const categoryNames = Object.keys(report.categories);

    expect(categoryNames.some((name) => name.startsWith("negotiation:"))).toBe(true);
    expect(categoryNames.some((name) => name.startsWith("wire:"))).toBe(true);
    expect(report.rejected).toBeGreaterThan(0);
    expect(report.accepted).toBeGreaterThan(0);
    expect(report.outcomes.every((outcome) => outcome.deterministic)).toBe(true);
    expect(report.outcomes.every((outcome) => outcome.state_unchanged_on_reject)).toBe(true);
  });
});

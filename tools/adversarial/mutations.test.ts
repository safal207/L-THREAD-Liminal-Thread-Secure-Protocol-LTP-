import { describe, expect, it } from "vitest";
import { runMutationCampaign } from "./mutations";

describe("WP6 security mutation campaign", () => {
  it("kills every intentionally weakened security mutant", () => {
    const outcomes = runMutationCampaign();

    expect(outcomes).toHaveLength(4);
    expect(outcomes.every((outcome) => outcome.killed)).toBe(true);
    expect(outcomes.map((outcome) => outcome.mutation_id)).toEqual([
      "allow-security-downgrade",
      "accept-unknown-required-capability",
      "mutate-state-on-reject",
      "accept-replayed-nonce",
    ]);
  });
});

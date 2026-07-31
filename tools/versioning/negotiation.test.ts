import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { negotiate } from "./negotiation";
import { loadRegistry, validateRegistry } from "./registry";

const registry = loadRegistry();
const fixture = JSON.parse(
  readFileSync(resolve("fixtures/versioning/negotiation-cases.json"), "utf8"),
) as { cases: Array<{ id: string; input: any; expected: any }> };

describe("WP5 capability registry", () => {
  it("classifies every normative v1 capability", () => {
    expect(() => validateRegistry(registry)).not.toThrow();
    const normative = registry.capabilities.filter((entry) => entry.normative_v1);
    expect(normative.length).toBeGreaterThan(0);
    expect(normative.every((entry) => ["required", "optional"].includes(entry.classification))).toBe(true);
    expect(normative.every((entry) => Boolean(entry.owner))).toBe(true);
  });

  it("does not advertise candidate 1.0 as wire-supported", () => {
    const candidate = registry.versions.find((entry) => entry.version === "1.0.0");
    expect(candidate?.status).toBe("candidate");
    expect(candidate?.wire_supported).toBe(false);
  });
});

describe("WP5 fail-closed negotiation fixtures", () => {
  for (const testCase of fixture.cases) {
    it(testCase.id, () => {
      const result = negotiate(registry, testCase.input);
      expect(result.ok).toBe(testCase.expected.ok);
      if (testCase.expected.ok) {
        expect(result.ok && result.selected_version).toBe(testCase.expected.selected_version);
        if (testCase.expected.resume_verdict) {
          expect(result.ok && result.resume?.verdict).toBe(testCase.expected.resume_verdict);
        }
      } else {
        expect(!result.ok && result.reason_code).toBe(testCase.expected.reason_code);
      }
    });
  }
});

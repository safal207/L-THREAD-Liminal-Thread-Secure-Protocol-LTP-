import { describe, expect, it } from "vitest";
import { loadRegistry } from "./registry";
import { evaluateResume } from "./resume-contract";

const registry = loadRegistry();
const legacy = registry.versions.find((entry) => entry.version === "0.3.0")!;
const current = registry.versions.find((entry) => entry.version === "0.6.0")!;
const candidate = registry.versions.find((entry) => entry.version === "1.0.0")!;

describe("WP5 state migration policy", () => {
  it("explicitly migrates a compatible 0.3 -> 0.6 resume", () => {
    const result = evaluateResume(registry, {
      protocol_version: legacy.version,
      snapshot_schema: legacy.snapshot_schema,
      canonical_envelope: legacy.canonical_envelope,
    }, current);
    expect(result.verdict).toBe("MIGRATE");
    expect(result.migration_id).toBe("state-v1-0.3-to-0.6");
    expect(result.preserves_session_identity).toBe(true);
  });

  it("rejects a breaking 0.6 -> 1.0 resume without approval", () => {
    const result = evaluateResume(registry, {
      protocol_version: current.version,
      snapshot_schema: current.snapshot_schema,
      canonical_envelope: current.canonical_envelope,
    }, candidate);
    expect(result.verdict).toBe("REJECT");
    expect(result.reason_code).toBe("MIGRATION_REQUIRED");
    expect(result.migration_id).toBe("state-v1-to-v2-1.0");
  });

  it("allows the declared breaking migration only with its exact approval id", () => {
    const result = evaluateResume(registry, {
      protocol_version: current.version,
      snapshot_schema: current.snapshot_schema,
      canonical_envelope: current.canonical_envelope,
    }, candidate, "state-v1-to-v2-1.0");
    expect(result.verdict).toBe("MIGRATE");
    expect(result.preserves_session_identity).toBe(false);
    expect(result.target_snapshot_schema).toBe(2);
  });

  it("blocks rollback from current state to a legacy protocol", () => {
    const result = evaluateResume(registry, {
      protocol_version: current.version,
      snapshot_schema: current.snapshot_schema,
      canonical_envelope: current.canonical_envelope,
    }, legacy);
    expect(result.verdict).toBe("REJECT");
    expect(result.reason_code).toBe("DOWNGRADE_BLOCKED");
  });
});

import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { runReferenceScenarios } from "./scenarios";

const EXPECTED_SCENARIOS = [
  "fresh-authenticated-handshake",
  "business-round-trip",
  "authenticated-ping-pong",
  "encrypted-metadata-round-trip",
  "invalid-signature",
  "stale-timestamp",
  "replayed-nonce",
  "broken-hash-chain",
  "same-session-resume",
  "post-resume-replay",
  "post-resume-business",
  "unsupported-version",
];

describe("independent LTP reference server", () => {
  it("passes the deterministic positive and negative wire scenario catalog", async () => {
    const report = await runReferenceScenarios({ seed: "wp1-contract" });

    expect(report.summary).toEqual({
      total: EXPECTED_SCENARIOS.length,
      passed: EXPECTED_SCENARIOS.length,
      failed: 0,
    });
    expect(report.scenarios.map((scenario) => scenario.id)).toEqual(EXPECTED_SCENARIOS);
    expect(report.scenarios.every((scenario) => scenario.passed)).toBe(true);

    const rejected = report.evidence.filter((record) => record.verdict === "REJECTED");
    expect(rejected.map((record) => record.reason_code)).toEqual(expect.arrayContaining([
      "INVALID_SIGNATURE",
      "STALE_TIMESTAMP",
      "REPLAYED_NONCE",
      "BROKEN_HASH_CHAIN",
      "UNSUPPORTED_VERSION",
    ]));

    const acceptedResume = report.evidence.find(
      (record) => record.reason_code === "HANDSHAKE_RESUME_ACCEPTED",
    );
    expect(acceptedResume?.state_digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("replays the same seed into byte-for-byte identical evidence", async () => {
    const first = await runReferenceScenarios({ seed: "wp1-repeatable" });
    const second = await runReferenceScenarios({ seed: "wp1-repeatable" });
    expect(second).toEqual(first);
  });

  it("does not expose secrets or depend on an SDK implementation", async () => {
    const report = await runReferenceScenarios({ seed: "wp1-redaction" });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("ltp-reference-long-term-secret");
    expect(serialized).not.toContain("macKey");
    expect(serialized).not.toContain("encryptionKey");
    expect(serialized).not.toContain("privateKey");

    const protocolSource = readFileSync("tools/reference-server/protocol.ts", "utf8");
    const serverSource = readFileSync("tools/reference-server/server.ts", "utf8");
    expect(protocolSource).not.toMatch(/from\s+["'][^"']*sdk\//);
    expect(serverSource).not.toMatch(/from\s+["'][^"']*sdk\//);
  });
});

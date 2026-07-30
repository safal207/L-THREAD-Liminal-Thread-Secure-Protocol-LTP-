import { describe, expect, it } from "vitest";
import {
  buildFaultSchedule,
  LifecycleFaultHarness,
  runWp3FaultSuite,
  sha256,
} from "./harness";

describe("LTP WP3 deterministic fault, race and crash contract", () => {
  it("reproduces the same fault schedule from the same seed", () => {
    const first = buildFaultSchedule("same-seed");
    const second = buildFaultSchedule("same-seed");
    expect(second).toEqual(first);
    expect(sha256(second)).toBe(sha256(first));
  });

  it("changes the schedule when the seed changes", () => {
    expect(sha256(buildFaultSchedule("seed-a"))).not.toBe(
      sha256(buildFaultSchedule("seed-b")),
    );
  });

  it("rejects a stale receive owner before state commit", () => {
    const harness = new LifecycleFaultHarness("stale-owner");
    const staleOwner = harness.ownerGeneration;
    harness.replaceOwner();
    const before = harness.persist();
    const verdict = harness.receive(
      staleOwner,
      harness.frame("late-frame", "late-nonce"),
    );
    const after = harness.persist();

    expect(verdict).toBe("STALE_TRANSPORT_OWNER");
    expect(after.last_received_hash).toBe(before.last_received_hash);
    expect(after.seen_nonces).toEqual(before.seen_nonces);
  });

  it("preserves replay state and the committed chain across restart", () => {
    const harness = new LifecycleFaultHarness("restart");
    expect(harness.receive(
      harness.ownerGeneration,
      harness.frame("first", "nonce-1"),
    )).toBe("SECURITY_PIPELINE_ACCEPTED");

    const snapshot = harness.persist();
    expect(harness.restoreSameSession(snapshot)).toBe("RESTORED");
    expect(harness.committedReceiveHash).toBe(snapshot.last_received_hash);

    const replay = harness.frame(
      "replay",
      "nonce-1",
      harness.committedReceiveHash,
    );
    expect(harness.receive(harness.ownerGeneration, replay)).toBe(
      "REPLAYED_NONCE",
    );
  });

  it("fails closed into one explicit fresh handshake for corrupt state", () => {
    const harness = new LifecycleFaultHarness("corrupt");
    const originalSession = harness.currentSessionId;
    const snapshot = harness.persist();

    expect(harness.restoreSameSession({
      ...snapshot,
      checksum: "ff".repeat(32),
    })).toBe("FRESH_HANDSHAKE_REQUIRED");

    const after = harness.persist();
    expect(after.session_id).not.toBe(originalSession);
    expect(after.fresh_reset_count).toBe(1);
    expect(after.last_received_hash).toBeNull();
    expect(after.seen_nonces).toEqual([]);
  });

  it("covers JavaScript, Python, Rust and Elixir ownership profiles", () => {
    const report = runWp3FaultSuite("runtime-matrix");
    const runtimeRows = report.scenarios.filter((entry) => entry.runtime);
    expect(runtimeRows.map((entry) => entry.runtime).sort()).toEqual([
      "elixir",
      "javascript",
      "python",
      "rust",
    ]);
    expect(runtimeRows.every((entry) => entry.passed)).toBe(true);
  });

  it("keeps traces free of secret material", () => {
    const report = runWp3FaultSuite("redaction");
    const raw = JSON.stringify(report);
    for (const forbidden of [
      "macKey",
      "encryptionKey",
      "privateKey",
      "secretKey",
      "longTermSecret",
    ]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it("passes the permanent deterministic CI subset", () => {
    const report = runWp3FaultSuite("wp3-ci-seed");
    expect(report.summary.failed).toBe(0);
    expect(report.summary.passed).toBe(report.summary.total);
    expect(report.schedule).toHaveLength(12);
  });
});

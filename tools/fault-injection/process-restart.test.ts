import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { LifecycleFaultHarness, SecuritySnapshot } from "./harness";

interface WorkerReport {
  schema_version: 1;
  process_id: number;
  restore: "RESTORED" | "FRESH_HANDSHAKE_REQUIRED";
  replay_verdict: string | null;
  session_id: string;
  last_received_hash: string | null;
  fresh_reset_count: number;
}

function runWorker(snapshot: SecuritySnapshot, seed: string): WorkerReport {
  const directory = mkdtempSync(join(tmpdir(), "ltp-wp3-process-"));
  const snapshotPath = join(directory, "snapshot.json");
  const outputPath = join(directory, "result.json");
  writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  try {
    const child = spawnSync(
      "pnpm",
      [
        "exec",
        "ts-node",
        "tools/fault-injection/process-worker.ts",
        snapshotPath,
        seed,
        outputPath,
      ],
      { encoding: "utf8" },
    );
    if (child.status !== 0) {
      throw new Error(`worker failed: ${child.stderr || child.stdout}`);
    }
    return JSON.parse(readFileSync(outputPath, "utf8")) as WorkerReport;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("WP3 process-boundary snapshot restoration", () => {
  it("restores the exact chain and replay set in a new process", () => {
    const seed = "process-restore";
    const harness = new LifecycleFaultHarness(seed);
    expect(harness.receive(
      harness.ownerGeneration,
      harness.frame("before-process-restart", "nonce-1"),
    )).toBe("SECURITY_PIPELINE_ACCEPTED");
    const snapshot = harness.persist();

    const report = runWorker(snapshot, seed);
    expect(report.process_id).not.toBe(process.pid);
    expect(report.restore).toBe("RESTORED");
    expect(report.session_id).toBe(snapshot.session_id);
    expect(report.last_received_hash).toBe(snapshot.last_received_hash);
    expect(report.replay_verdict).toBe("REPLAYED_NONCE");
    expect(report.fresh_reset_count).toBe(0);
  });

  it("fails closed into one fresh session when the cross-process snapshot is corrupt", () => {
    const seed = "process-corrupt";
    const harness = new LifecycleFaultHarness(seed);
    const snapshot = harness.persist();
    const report = runWorker({
      ...snapshot,
      checksum: "00".repeat(32),
    }, seed);

    expect(report.process_id).not.toBe(process.pid);
    expect(report.restore).toBe("FRESH_HANDSHAKE_REQUIRED");
    expect(report.replay_verdict).toBeNull();
    expect(report.session_id).not.toBe(snapshot.session_id);
    expect(report.fresh_reset_count).toBe(1);
  });
});

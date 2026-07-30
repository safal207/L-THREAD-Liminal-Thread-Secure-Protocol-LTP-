import { readFileSync, writeFileSync } from "node:fs";
import { LifecycleFaultHarness, SecuritySnapshot } from "./harness";

const [snapshotPath, seed, outputPath] = process.argv.slice(2);
if (!snapshotPath || !seed || !outputPath) {
  throw new Error("usage: process-worker <snapshot> <seed> <output>");
}

const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as SecuritySnapshot;
const harness = new LifecycleFaultHarness(seed);
const restore = harness.restoreSameSession(snapshot);
let replayVerdict: string | null = null;
if (restore === "RESTORED") {
  const replay = harness.frame(
    "process-restart-replay",
    snapshot.seen_nonces[0] ?? "nonce-1",
    harness.committedReceiveHash,
  );
  replayVerdict = harness.receive(harness.ownerGeneration, replay);
}
const after = harness.persist();
const report = {
  schema_version: 1,
  process_id: process.pid,
  restore,
  replay_verdict: replayVerdict,
  session_id: after.session_id,
  last_received_hash: after.last_received_hash,
  fresh_reset_count: after.fresh_reset_count,
};
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

import assert from "node:assert/strict";
import { mapToFocusSnapshotEnvelope } from "../ltp-node-gateway";

function testMapsValidSnapshot() {
  const envelope = mapToFocusSnapshotEnvelope({
    type: "focus_snapshot",
    timestamp: 1700000000000,
    focusMomentum: 0.5,
  });

  assert.ok(envelope, "should map valid snapshot");
  assert.equal(envelope?.type, "focus_snapshot");
  assert.ok(envelope?.timestamp.includes("T"));
  assert.equal(envelope?.payload.focusMomentum, 0.5);
}

function testIgnoresOtherMessages() {
  const envelope = mapToFocusSnapshotEnvelope({ type: "heartbeat" });
  assert.equal(envelope, null);
}

try {
  testMapsValidSnapshot();
  testIgnoresOtherMessages();
  console.log("ltp-node-gateway tests passed");
} catch (err) {
  console.error("ltp-node-gateway tests failed", err);
  process.exitCode = 1;
}

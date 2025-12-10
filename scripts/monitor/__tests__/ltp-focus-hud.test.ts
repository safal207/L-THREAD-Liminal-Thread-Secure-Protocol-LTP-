import assert from "node:assert/strict";
import {
  determineLinkHealth,
  FocusHudSnapshot,
  renderFocusHudLine,
} from "../ltp-focus-hud";

function testRendersLine() {
  const snapshot: FocusHudSnapshot = {
    linkHealth: "OK",
    latencyMs: 42,
    jitterMs: 3,
    sector: "sector.alpha",
    intent: "EXPLORE",
    focusMomentum: 0.87,
  };

  const line = renderFocusHudLine(snapshot, [0.1, 0.5, 0.87], "calm");
  assert.ok(line.length > 0, "rendered line should not be empty");
  assert.match(line, /^\[CALM\]\[OK\]/, "line should start with mode and health tags");
  assert.ok(line.includes("fm:"), "line should include focus momentum section");
}

function testLinkHealthHeuristic() {
  assert.equal(determineLinkHealth(50, 5), "OK");
  assert.equal(determineLinkHealth(150, 10), "WARN");
  assert.equal(determineLinkHealth(undefined, undefined), "CRIT");
}

function testWarnTagAppears() {
  const snapshot: FocusHudSnapshot = {
    linkHealth: "WARN",
    latencyMs: 180,
    sector: "sector.beta",
  };

  const line = renderFocusHudLine(snapshot, []);
  assert.ok(line.startsWith("[WARN]"));
}

try {
  testRendersLine();
  testLinkHealthHeuristic();
  testWarnTagAppears();
  console.log("ltp-focus-hud tests passed");
} catch (err) {
  console.error("ltp-focus-hud tests failed", err);
  process.exitCode = 1;
}

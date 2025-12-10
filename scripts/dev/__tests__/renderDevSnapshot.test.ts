import assert from "assert";
import { renderDevSnapshot } from "../ltp-node-demo";
import { LinkHealth } from "../utils/consoleColors";

function capture(fn: () => void): string[] {
  const original = console.log;
  const lines: string[] = [];
  console.log = (msg?: unknown) => {
    lines.push(String(msg));
  };
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines;
}

const baseSnapshot = {
  linkHealth: "warn" as LinkHealth,
  heartbeat: { latencyMs: 42 },
  routing: { suggestedSector: "sector.alpha", intent: "STABLE" },
  focusMomentum: { value: 0.72 },
};

const lines = capture(() => renderDevSnapshot(baseSnapshot));
assert.ok(lines[0].includes("[WARN]"));
assert.ok(lines[0].includes("hb=42ms"));
assert.ok(lines[0].includes("routing=sector.alpha"));
assert.ok(lines[0].includes("intent=STABLE"));
assert.ok(lines[0].includes("focusMomentum=+0.72"));

const missingLines = capture(() =>
  renderDevSnapshot({
    linkHealth: "critical",
    focusMomentum: {},
  }),
);
assert.ok(missingLines[0].includes("hb=?"));
assert.ok(missingLines[0].includes("fm=–"));

console.log("renderDevSnapshot compact output ok");

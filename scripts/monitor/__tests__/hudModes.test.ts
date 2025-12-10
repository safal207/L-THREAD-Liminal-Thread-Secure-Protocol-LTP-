import assert from "node:assert/strict";
import { countSignFlips, detectHudMode, isMonotonic } from "../hudModes";

type LinkHealth = "OK" | "WARN" | "CRIT";

type TestCase = {
  name: string;
  focusHistory: number[];
  linkHealth: LinkHealth;
  expected: "calm" | "storm" | "shift";
};

const cases: TestCase[] = [
  {
    name: "calm for low-volatility focus near zero",
    focusHistory: [0.05, 0.1, 0.08, 0.09],
    linkHealth: "OK",
    expected: "calm",
  },
  {
    name: "storm for high volatility with flips",
    focusHistory: [0.8, -0.7, 0.9, -0.6, 0.7],
    linkHealth: "WARN",
    expected: "storm",
  },
  {
    name: "shift for rising trend",
    focusHistory: [-0.1, 0.1, 0.3, 0.6, 0.9],
    linkHealth: "OK",
    expected: "shift",
  },
  {
    name: "shift for falling trend",
    focusHistory: [0.8, 0.6, 0.4, 0.1, -0.1],
    linkHealth: "OK",
    expected: "shift",
  },
  {
    name: "storm when link health is critical regardless of volatility",
    focusHistory: [0.01, 0.02, 0.03, 0.04],
    linkHealth: "CRIT",
    expected: "storm",
  },
];

function runModeCases() {
  for (const testCase of cases) {
    const mode = detectHudMode({
      focusHistory: testCase.focusHistory,
      linkHealth: testCase.linkHealth,
    });
    assert.equal(mode, testCase.expected, testCase.name);
  }
}

function runHelpers() {
  assert.equal(countSignFlips([1, -1, 1, -1, 1]), 4, "counts sign flips across history");
  assert.equal(countSignFlips([0.1, 0.2, 0.3]), 0, "ignores monotonic positive values");
  assert.equal(countSignFlips([0, 1, -1]), 1, "ignores zeros when counting flips");

  assert.ok(isMonotonic([1, 2, 3, 4], "up"), "detects rising sequences");
  assert.ok(isMonotonic([4, 3, 2, 1], "down"), "detects falling sequences");
  assert.ok(!isMonotonic([1, 3, 2, 4], "up"), "rejects non-monotonic sequences");
  assert.ok(!isMonotonic([1, 2, 3], "up"), "requires minimum length for trends");
}

try {
  runModeCases();
  runHelpers();
  console.log("hudModes tests passed");
} catch (err) {
  console.error("hudModes tests failed", err);
  process.exitCode = 1;
}

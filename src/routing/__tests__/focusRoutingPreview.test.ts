import assert from "assert";
import { buildRoutingPreview, FocusSnapshot, RoutingDecision } from "../focusRoutingPreview";

function createDecision(options: RoutingDecision["options"]): RoutingDecision {
  return { options };
}

function testPrimaryAndAlternatives() {
  const snapshot: FocusSnapshot = { sector: "/home/focus/study", focusMomentum: 0.5 };
  const routingDecision = createDecision([
    { sector: "/home/rest/walk", score: 0.42 },
    { sector: "/home/focus/deep_work", score: 0.91 },
    { sector: "/home/focus/reflect", score: 0.63 },
    { sector: "/home/focus/ideate", score: 0.61 },
  ]);

  const preview = buildRoutingPreview({ snapshot, routingDecision, volatilityScore: 0.2 });

  assert.strictEqual(preview.primaryNextSector, "/home/focus/deep_work");
  assert.deepStrictEqual(preview.alternativeSectors, ["/home/focus/reflect", "/home/focus/ideate"]);
}

function testReasonHighMomentumLowVolatility() {
  const snapshot: FocusSnapshot = { sector: "alpha", focusMomentum: 0.85 };
  const routingDecision = createDecision([{ sector: "beta", score: 0.5 }]);

  const preview = buildRoutingPreview({ snapshot, routingDecision, volatilityScore: 0.1 });

  assert.strictEqual(preview.reason, "stable focus, deepening current trajectory");
}

function testReasonLowMomentumHighVolatility() {
  const snapshot: FocusSnapshot = { sector: "alpha", focusMomentum: 0.2 };
  const routingDecision = createDecision([{ sector: "beta", score: 0.5 }]);

  const preview = buildRoutingPreview({ snapshot, routingDecision, volatilityScore: 0.72 });

  assert.strictEqual(preview.reason, "fragmented focus, suggesting soft shift");
}

function testReasonWithAlternativeCap() {
  const snapshot: FocusSnapshot = { sector: "alpha", focusMomentum: 0.55 };
  const routingDecision = createDecision([
    { sector: "beta", score: 0.8 },
    { sector: "gamma", score: 0.7 },
    { sector: "delta", score: 0.6 },
  ]);

  const preview = buildRoutingPreview({ snapshot, routingDecision, volatilityScore: 0.3 });

  assert.strictEqual(preview.reason, "growing momentum with some fluctuation, proposing careful step");
  assert.deepStrictEqual(preview.alternativeSectors, ["gamma", "delta"]);
}

try {
  testPrimaryAndAlternatives();
  testReasonHighMomentumLowVolatility();
  testReasonLowMomentumHighVolatility();
  testReasonWithAlternativeCap();
  console.log("focusRoutingPreview tests passed");
} catch (err) {
  console.error("focusRoutingPreview tests failed", err);
  process.exitCode = 1;
}

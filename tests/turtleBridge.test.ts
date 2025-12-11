import assert from "assert";

import {
  attachTurtleSnapshotToOrientation,
  chooseTurtleFrameFromTimeWeave,
  type TemporalOrientationView,
  type TimeWeaveSummary,
} from "../src/routing/focusRoutingPreview";

function buildOrientation(overrides: Partial<TemporalOrientationView> = {}): TemporalOrientationView {
  return {
    currentSector: "baseline",
    focusMomentum: 0,
    volatility: 0,
    ...overrides,
  };
}

(function testBaselineTurtleSelection() {
  const orientation = buildOrientation();
  const summary: TimeWeaveSummary = {};

  const view = attachTurtleSnapshotToOrientation({ orientation, timeWeaveSummary: summary });

  assert.strictEqual(view.turtle?.currentFrameId, "baseline");
})();

(function testFutureBiasedSelection() {
  const orientation = buildOrientation({ focusMomentum: 0.4 });
  const summary: TimeWeaveSummary = { futureBias: 0.8 };

  const frame = chooseTurtleFrameFromTimeWeave(summary, orientation.focusMomentum);
  assert.strictEqual(frame, "deep_time");

  const view = attachTurtleSnapshotToOrientation({ orientation, timeWeaveSummary: summary });
  assert.strictEqual(view.turtle?.currentFrameId, "deep_time");
})();

(function testFamilyFieldSelection() {
  const orientation = buildOrientation({ focusMomentum: 0.2 });
  const summary: TimeWeaveSummary = { futureBias: 0.3, familyWeight: 0.72 };

  const view = attachTurtleSnapshotToOrientation({ orientation, timeWeaveSummary: summary });
  assert.strictEqual(view.turtle?.currentFrameId, "family_field");
})();

console.log("turtleBridge tests passed");

import assert from "assert";
import {
  buildMultiPathSuggestion,
  RoutingDecision,
  TemporalOrientationView,
} from "../src/routing/focusRoutingPreview";

function createRouting(options: RoutingDecision["options"]): RoutingDecision {
  return { options };
}

function buildOrientation(overrides: Partial<TemporalOrientationView>): TemporalOrientationView {
  return {
    currentSector: "deep_work",
    focusMomentum: 0,
    volatility: 0,
    ...overrides,
  };
}

(function testStablePhasePrimaryDominates() {
  const orientation = buildOrientation({ currentSector: "deep_work", focusMomentum: 0.82, volatility: 0.08 });
  const routing = createRouting([
    { sector: "deep_work", score: 0.82 },
    { sector: "light_work", score: 0.45 },
    { sector: "planning", score: 0.32 },
  ]);

  const suggestion = buildMultiPathSuggestion(orientation, routing);
  assert.ok(["stabilize", "grow"].includes(suggestion.primaryPath.label));
  suggestion.alternates.forEach((alt) => {
    assert.ok(
      suggestion.primaryPath.overallLikelihood > alt.overallLikelihood,
      "primary path should carry higher likelihood than alternates",
    );
  });
})();

(function testStormPhaseIncludesRecovery() {
  const orientation = buildOrientation({ currentSector: "social", focusMomentum: -0.06, volatility: 0.72 });
  const routing = createRouting([
    { sector: "social", score: 0.38 },
    { sector: "rest", score: 0.36 },
    { sector: "planning", score: 0.3 },
  ]);

  const suggestion = buildMultiPathSuggestion(orientation, routing);
  const recover = suggestion.alternates.find((alt) => alt.label === "recover");
  assert.ok(recover, "recover path should be present during storm phase");
  const restNode = recover.nodes.find((node) => node.sectorId.includes("rest"));
  assert.ok(restNode, "recover path should target a rest-like sector");
  assert.ok(suggestion.primaryPath.overallLikelihood < 1, "primary likelihood should leave room for alternatives");
})();

(function testRecoveryPhaseRebuildsMomentum() {
  const stormOrientation = buildOrientation({ currentSector: "social", focusMomentum: -0.02, volatility: 0.68 });
  const stormRouting = createRouting([
    { sector: "rest", score: 0.4 },
    { sector: "social", score: 0.35 },
    { sector: "planning", score: 0.33 },
  ]);
  const stormSuggestion = buildMultiPathSuggestion(stormOrientation, stormRouting);
  const stormRecover = stormSuggestion.alternates.find((alt) => alt.label === "recover");
  const stormRecoverLikelihood = stormRecover?.overallLikelihood ?? 0;

  const orientation = buildOrientation({ currentSector: "planning", focusMomentum: 0.48, volatility: 0.26 });
  const routing = createRouting([
    { sector: "planning", score: 0.62 },
    { sector: "light_work", score: 0.58 },
    { sector: "social", score: 0.22 },
  ]);

  const suggestion = buildMultiPathSuggestion(orientation, routing);
  const primaryTailSector = suggestion.primaryPath.nodes[suggestion.primaryPath.nodes.length - 1].sectorId;
  assert.ok(
    ["planning", "light_work"].some((sector) => primaryTailSector.includes(sector)),
    "primary should guide toward constructive work sector",
  );

  const recover = suggestion.alternates.find((alt) => alt.label === "recover");
  assert.ok(recover, "recover path should remain available during recovery phase");
  assert.ok(
    recover.overallLikelihood < stormRecoverLikelihood,
    "recover likelihood should drop as volatility decreases",
  );
})();

import assert from "assert";
import { renderConsciousnessWeb } from "../../src/visualization/consciousnessWebVisualizer";
import { buildConsciousnessSnapshot } from "../../sdk/js/src/consciousnessWeb";
import { ANSI } from "../../src/visualization/colorTheme";

type PartialSnapshot = Parameters<typeof buildConsciousnessSnapshot>[0];

function snapshot(overrides: PartialSnapshot) {
  return buildConsciousnessSnapshot({
    orientation: "calm",
    focusMomentum: 0.44,
    volatility: 0.3,
    resilience: 0.6,
    ...overrides,
  });
}

(function testCalmOrientation() {
  const output = renderConsciousnessWeb(snapshot({ orientation: "calm" }), { colorize: false, mode: "debug" });
  assert.ok(output.includes(">>>>>>> [ CALM ] <<<<<<<"), "Calm sector should be highlighted");
})();

(function testStormOrientation() {
  const output = renderConsciousnessWeb(snapshot({ orientation: "storm" }), { colorize: false, mode: "debug" });
  assert.ok(output.includes(">>>>>>> [ STORM ] <<<<<<<"), "Storm sector should be highlighted");
})();

(function testColorSchemePresence() {
  const output = renderConsciousnessWeb(snapshot({ orientation: "storm" }), { colorize: true });
  assert.ok(output.includes(ANSI.red), "Storm color code should be applied");
  assert.ok(output.includes(ANSI.blue), "Calm color code should be applied");
})();

(function testFutureWeaveBlock() {
  const output = renderConsciousnessWeb(
    snapshot({
      orientation: "storm",
      futurePaths: [
        { role: "primary", label: "Shift", path: ["storm", "shift", "growth"], probability: 0.44 },
        { role: "recover", label: "Recover", path: ["storm", "recovery"], probability: 0.33 },
        { role: "explore", label: "Explore", path: ["storm", "growth", "calm"], probability: 0.23 },
      ],
    }),
    { colorize: false },
  );
  assert.ok(output.includes("Future Paths:"), "Future paths header present");
  assert.ok(output.includes("STORM → SHIFT → GROWTH"), "Primary path rendered");
})();

(function testTimeAnchorsBlock() {
  const output = renderConsciousnessWeb(
    snapshot({
      timeAnchors: [
        { offset: -3, label: "stable" },
        { offset: -2, label: "rising tension" },
        { offset: -1, label: "storm onset" },
        { offset: 1, label: "possible shift", confidence: 0.74 },
      ],
    }),
    { colorize: false },
  );
  assert.ok(output.includes("Time Anchors:"));
  assert.ok(output.includes("+1: possible shift"));
})();

(function testHumanModeRendering() {
  const output = renderConsciousnessWeb(
    snapshot({
      orientation: "growth",
      futurePaths: [
        { role: "primary", label: "Forward", path: ["growth", "shift", "calm"], probability: 0.5 },
        { role: "explore", label: "Alternate", path: ["growth", "storm"], probability: 0.5 },
      ],
    }),
    { colorize: false, mode: "human" },
  );

  assert.ok(output.includes("HUMAN VIEW"), "Human mode header present");
  assert.ok(output.includes("Pulse: momentum"), "Pulse line present");
})();

(function testStoryModeRendering() {
  const output = renderConsciousnessWeb(
    snapshot({
      orientation: "shift",
      focusMomentum: 0.82,
      futurePaths: [
        { role: "primary", label: "Settle", path: ["shift", "calm"], probability: 0.62 },
        { role: "explore", label: "Branch", path: ["shift", "growth"], probability: 0.38 },
      ],
    }),
    { colorize: false, mode: "story" },
  );

  assert.ok(output.includes("STORY MODE"), "Story mode header present");
  assert.ok(output.includes("One strong path opens toward CALM (0.62 chance)."), "Primary narrative rendered");
})();

console.log("consciousnessWebVisualizer tests passed");

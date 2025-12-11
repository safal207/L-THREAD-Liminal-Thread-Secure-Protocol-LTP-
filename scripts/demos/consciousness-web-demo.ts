import { renderConsciousnessWeb } from "../../src/visualization/consciousnessWebVisualizer";
import { buildConsciousnessSnapshot } from "../../sdk/js/src/consciousnessWeb";

const snapshot = buildConsciousnessSnapshot({
  orientation: "storm",
  focusMomentum: 0.44,
  volatility: 0.71,
  timeAnchors: [
    { offset: -3, label: "stable" },
    { offset: -2, label: "rising tension" },
    { offset: -1, label: "storm onset" },
    { offset: 1, label: "potential shift", confidence: 0.74 },
  ],
  futurePaths: [
    { role: "primary", label: "Shift", path: ["storm", "shift", "growth"], probability: 0.44 },
    { role: "recover", label: "Recover", path: ["storm", "recovery"], probability: 0.33 },
    { role: "explore", label: "Explore", path: ["storm", "growth", "calm"], probability: 0.23 },
  ],
});

console.log(renderConsciousnessWeb(snapshot));

import assert from "assert";
import { renderFutureWeaveGraph } from "../../src/visualization/futureWeaveGraph";
import { type MultiPathSuggestion, type FutureWeavePath } from "../../src/routing/temporal-multipath";

function createPath(
  pathId: string,
  label: string,
  likelihood: number,
  sectors: string[],
  expectedFocusMomentum: number,
  volatilityHint: number,
): FutureWeavePath {
  return {
    pathId,
    label,
    nodes: [
      {
        id: `${pathId}-0`,
        sectorId: sectors[0] ?? "?",
        timeOffsetMs: 0,
        expectedFocusMomentum,
        volatilityHint,
        likelihood,
      },
    ],
    overallLikelihood: likelihood,
  };
}

const mockSuggestion: MultiPathSuggestion = {
  primaryPath: createPath("primary", "Main Focus", 0.68, ["home", "work"], 0.7, 0.15),
  alternates: [
    createPath("recover", "Recover", 0.2, ["health"], 0.55, 0.35),
    createPath("explore", "Explore", 0.12, ["planning"], 0.48, 0.72),
  ],
  branches: [
    {
      id: "primary",
      role: "primary",
      label: "Main Focus",
      likelihood: 0.68,
      momentumHint: "rising",
      volatilityHint: "low",
      softenedSectors: ["home", "work"],
    },
    {
      id: "recovery",
      role: "recovery",
      label: "Recover",
      likelihood: 0.2,
      momentumHint: "stable",
      volatilityHint: "mid",
      softenedSectors: ["health"],
    },
    {
      id: "explore",
      role: "explore",
      label: "Explore",
      likelihood: 0.12,
      momentumHint: "falling",
      volatilityHint: "high",
      softenedSectors: [],
    },
  ],
};

(function testOrdering() {
  const lines = renderFutureWeaveGraph(mockSuggestion).split("\n");
  assert.ok(lines[0].startsWith("primary"), "primary should be first line");
  assert.ok(lines[1].startsWith("recovery"), "recovery should be second line");
  assert.ok(lines[2].startsWith("explore"), "explore should be third line");
})();

(function testNormalizedLikelihoods() {
  const lines = renderFutureWeaveGraph(mockSuggestion).split("\n");
  const percents = lines.slice(0, 3).map((line) => Number(line.match(/\((\d+)%\)/)?.[1] ?? 0));
  const sum = percents.reduce((total, value) => total + value, 0);
  assert.deepStrictEqual(percents, [68, 20, 12]);
  assert.strictEqual(sum, 100);
})();

(function testArrowStrengthOrdering() {
  const lines = renderFutureWeaveGraph(mockSuggestion).split("\n");
  const arrowCounts = lines.slice(0, 3).map((line) => (line.match(/>/g) ?? []).length);
  assert.ok(arrowCounts[0] > arrowCounts[1]);
  assert.ok(arrowCounts[1] > arrowCounts[2]);
})();

(function testMetaToggle() {
  const lines = renderFutureWeaveGraph(mockSuggestion, { showMeta: false }).split("\n");
  lines.slice(0, 3).forEach((line) => {
    assert.ok(line.includes("%"));
    assert.ok(!line.includes("mom:"));
    assert.ok(!line.includes("vol:"));
  });
})();

(function testMaxBranches() {
  const lines = renderFutureWeaveGraph(mockSuggestion, { maxBranches: 2 }).split("\n");
  assert.strictEqual(lines.length, 3);
  assert.ok(lines[0].startsWith("primary"));
  assert.ok(lines[1].startsWith("recovery"));
  assert.ok(lines[2].includes("branches hidden"));
})();

console.log("futureWeaveGraph tests passed");

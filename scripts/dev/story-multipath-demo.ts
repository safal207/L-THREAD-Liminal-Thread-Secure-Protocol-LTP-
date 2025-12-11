import { buildMultiPathSuggestion, type RoutingDecision, type TemporalOrientationView } from "../../src/routing/temporal-multipath";
import { renderFutureWeaveGraph } from "../../src/visualization/futureWeaveGraph";

type Scenario = {
  readonly name: string;
  readonly orientation: TemporalOrientationView;
  readonly routing: RoutingDecision;
};

const SCENARIOS: Scenario[] = [
  {
    name: "stable",
    orientation: { currentSector: "deep_work", focusMomentum: 0.76, volatility: 0.12 },
    routing: {
      options: [
        { sector: "deep_work", score: 0.82 },
        { sector: "planning", score: 0.3 },
        { sector: "light_work", score: 0.22 },
      ],
    },
  },
  {
    name: "storm",
    orientation: { currentSector: "social", focusMomentum: -0.05, volatility: 0.7 },
    routing: {
      options: [
        { sector: "social", score: 0.36 },
        { sector: "rest", score: 0.38 },
        { sector: "planning", score: 0.3 },
      ],
    },
  },
  {
    name: "recovery",
    orientation: { currentSector: "planning", focusMomentum: 0.44, volatility: 0.28 },
    routing: {
      options: [
        { sector: "planning", score: 0.6 },
        { sector: "light_work", score: 0.55 },
        { sector: "social", score: 0.18 },
      ],
    },
  },
];

function runDemo(): void {
  SCENARIOS.forEach((scenario) => {
    const suggestion = buildMultiPathSuggestion(scenario.orientation, scenario.routing);
    const graph = renderFutureWeaveGraph(suggestion);
    console.log(`=== SCENARIO: ${scenario.name} ===`);
    console.log(graph);
    console.log("");
  });
}

if (require.main === module) {
  runDemo();
}

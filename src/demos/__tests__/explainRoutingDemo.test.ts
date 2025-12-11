import assert from "assert";
import { explainRoutingForDemoScenario } from "../explainRoutingDemo";

(function testExplainRoutingDemoScenario() {
  const result = explainRoutingForDemoScenario();

  assert.ok(result.decision.intent.length > 0, "intent should be present");
  assert.ok(result.decision.reasons.length > 0, "explanation reasons should be generated");
  assert.ok(result.highlightedPathIds.length > 0, "a highlighted path should be reported");
  assert.ok(result.graph.includes("CHOSEN"), "graph output should mark the chosen path");
})();

console.log("explainRoutingDemo tests passed");

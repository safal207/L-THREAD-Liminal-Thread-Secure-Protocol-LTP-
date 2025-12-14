import { runBasicRoutingScenario } from "./scenario-basic-routing";
import { runDegradedLoadScenario } from "./scenario-degraded-load";
import { runNegativeScenarios } from "./scenario-conformance-negative";

const runAll = (): void => {
  runBasicRoutingScenario();
  console.log("\n");
  runDegradedLoadScenario();
  console.log("\n");
  runNegativeScenarios();
};

if (require.main === module) {
  runAll();
}

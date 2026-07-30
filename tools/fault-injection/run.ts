import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { runWp3FaultSuite } from "./harness";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const seed = arg("--seed") ?? "wp3-ci-seed";
const outputPath = arg("--out") ?? "artifacts/wp3-fault-evidence.json";
const extended = process.argv.includes("--extended");
const report = runWp3FaultSuite(seed, extended);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report.summary));

if (report.summary.failed > 0) process.exitCode = 1;

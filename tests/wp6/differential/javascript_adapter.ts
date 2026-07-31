import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { serializeCanonical } from "../../../sdk/js/src/crypto";
import { DifferentialCorpus } from "./corpus";
import { buildReport } from "./common";

function main(): void {
  const [corpusPath, outputPath] = process.argv.slice(2);
  if (!corpusPath || !outputPath) {
    throw new Error("usage: javascript_adapter.ts <corpus.json> <output.json>");
  }
  const corpus = JSON.parse(readFileSync(resolve(corpusPath), "utf8")) as DifferentialCorpus;
  const report = buildReport("javascript", corpus, (value) => serializeCanonical(value as any));
  writeFileSync(resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

main();

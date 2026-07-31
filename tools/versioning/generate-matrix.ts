import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildMatrix, MatrixFixture, renderMatrixMarkdown } from "./matrix";
import { loadRegistry } from "./registry";

const fixtures = JSON.parse(
  readFileSync(resolve("fixtures/versioning/negotiation-cases.json"), "utf8"),
) as { cases: MatrixFixture[] };
const rows = buildMatrix(loadRegistry(), fixtures.cases);
const markdown = renderMatrixMarkdown(rows);
const args = process.argv.slice(2);
const docPath = resolve("docs/protocol/generated/SUPPORTED_VERSION_MATRIX.md");

if (args.includes("--check")) {
  const tracked = readFileSync(docPath, "utf8");
  if (tracked !== markdown) throw new Error("GENERATED_VERSION_MATRIX_IS_STALE");
}

const outIndex = args.indexOf("--out");
if (outIndex >= 0) {
  const outputPath = resolve(args[outIndex + 1]);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify({
    schema_version: 1,
    profile: "org.ltp.protocol.compatibility-matrix.v1",
    summary: {
      total: rows.length,
      passed: rows.filter((row) => row.verdict === "PASS").length,
      failed: rows.filter((row) => row.verdict === "FAIL").length,
    },
    rows,
  }, null, 2)}\n`, "utf8");
}

if (rows.some((row) => row.verdict === "FAIL")) process.exitCode = 1;

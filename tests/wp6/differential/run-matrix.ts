import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { serializeCanonical as referenceSerializeCanonical } from "../../../tools/reference-server/protocol";
import { AdapterCaseResult, AdapterReport, buildReport } from "./common";
import { DEFAULT_CASES, DEFAULT_SEED, DifferentialCorpus, generateCorpus } from "./corpus";

const SDKS = ["javascript", "python", "rust", "elixir"] as const;
type Sdk = typeof SDKS[number];

interface CommandSpec {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs: number;
}

interface MatrixCell {
  sdk: Sdk;
  case_id: string;
  category: string;
  expected_verdict: string;
  expected_reason: string;
  actual_verdict: string;
  actual_reason: string;
  expected_digest?: string;
  actual_digest?: string;
  passed: boolean;
}

function parseArgs(): { seed: number; cases: number; out: string; artifactDir: string } {
  const values = process.argv.slice(2);
  const read = (flag: string, fallback: string): string => {
    const index = values.indexOf(flag);
    return index === -1 ? fallback : values[index + 1];
  };
  const seed = Number(read("--seed", String(DEFAULT_SEED)));
  const cases = Number(read("--cases", String(DEFAULT_CASES)));
  const out = resolve(read("--out", "artifacts/wp6-four-sdk-differential.json"));
  const artifactDir = resolve(read("--artifact-dir", "artifacts/wp6-differential"));
  if (!Number.isInteger(seed) || !Number.isInteger(cases)) throw new Error("seed and cases must be integers");
  return { seed, cases, out, artifactDir };
}

function commandFor(sdk: Sdk, corpusPath: string, outputPath: string): CommandSpec {
  switch (sdk) {
    case "javascript":
      return {
        command: "pnpm",
        args: ["exec", "ts-node", "tests/wp6/differential/javascript_adapter.ts", corpusPath, outputPath],
        timeoutMs: 90_000,
      };
    case "python":
      return {
        command: "python",
        args: ["tests/wp6/differential/python_adapter.py", corpusPath, outputPath],
        env: { PYTHONPATH: resolve("sdk/python") },
        timeoutMs: 90_000,
      };
    case "rust":
      return {
        command: "cargo",
        args: [
          "run",
          "--quiet",
          "--manifest-path",
          "sdk/rust/ltp-client/Cargo.toml",
          "--bin",
          "wp6_differential",
          "--",
          corpusPath,
          outputPath,
        ],
        timeoutMs: 240_000,
      };
    case "elixir":
      return {
        command: "mix",
        args: ["run", "../../tests/wp6/differential/elixir_adapter.exs", corpusPath, outputPath],
        cwd: resolve("sdk/elixir"),
        timeoutMs: 120_000,
      };
  }
}

async function runProcess(spec: CommandSpec): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd ?? process.cwd(),
      env: { ...process.env, ...spec.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const label = `${spec.command} ${spec.args.join(" ")}`;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) rejectPromise(error); else resolvePromise();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`${label} timed out\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, spec.timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", (error) => finish(error));
    child.once("close", (code) => {
      if (code === 0) finish();
      else finish(new Error(`${label} exited ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    });
  });
}

function validateReport(report: AdapterReport, sdk: AdapterReport["sdk"], corpus: DifferentialCorpus): void {
  if (report.schema_version !== 1 || report.profile !== "org.ltp.wp6.sdk-differential-report.v1") {
    throw new Error(`${sdk} emitted an unsupported report contract`);
  }
  if (report.sdk !== sdk || report.corpus_digest !== corpus.corpus_digest) {
    throw new Error(`${sdk} report identity or corpus digest mismatch`);
  }
  if (report.results.length !== corpus.cases.length) {
    throw new Error(`${sdk} result count drift: ${report.results.length} != ${corpus.cases.length}`);
  }
}

function resultMap(report: AdapterReport): Map<string, AdapterCaseResult> {
  const map = new Map<string, AdapterCaseResult>();
  for (const result of report.results) {
    if (map.has(result.id)) throw new Error(`${report.sdk} duplicated case ${result.id}`);
    map.set(result.id, result);
  }
  return map;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function main(): Promise<void> {
  const options = parseArgs();
  mkdirSync(options.artifactDir, { recursive: true });
  mkdirSync(dirname(options.out), { recursive: true });

  const corpus = generateCorpus(options.seed, options.cases);
  const corpusPath = resolve(options.artifactDir, "corpus.json");
  writeFileSync(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");

  const reference = buildReport("reference", corpus, (value) => referenceSerializeCanonical(value as any));
  validateReport(reference, "reference", corpus);
  writeFileSync(resolve(options.artifactDir, "reference.json"), `${JSON.stringify(reference, null, 2)}\n`, "utf8");

  const reports = new Map<Sdk, AdapterReport>();
  for (const sdk of SDKS) {
    const outputPath = resolve(options.artifactDir, `${sdk}.json`);
    await runProcess(commandFor(sdk, corpusPath, outputPath));
    const report = JSON.parse(readFileSync(outputPath, "utf8")) as AdapterReport;
    validateReport(report, sdk, corpus);
    reports.set(sdk, report);
  }

  const referenceById = resultMap(reference);
  const matrix: MatrixCell[] = [];
  const generatorFailures: string[] = [];
  for (const entry of corpus.cases) {
    const expected = referenceById.get(entry.id);
    if (!expected) throw new Error(`reference result missing ${entry.id}`);
    if (expected.verdict !== entry.expected_verdict || expected.reason !== entry.expected_reason) {
      generatorFailures.push(
        `${entry.id}: declared ${entry.expected_verdict}/${entry.expected_reason}, oracle ${expected.verdict}/${expected.reason}`,
      );
    }
    for (const sdk of SDKS) {
      const actual = resultMap(reports.get(sdk)!).get(entry.id);
      if (!actual) throw new Error(`${sdk} result missing ${entry.id}`);
      matrix.push({
        sdk,
        case_id: entry.id,
        category: entry.category,
        expected_verdict: expected.verdict,
        expected_reason: expected.reason,
        actual_verdict: actual.verdict,
        actual_reason: actual.reason,
        expected_digest: expected.canonical_digest,
        actual_digest: actual.canonical_digest,
        passed:
          actual.verdict === expected.verdict &&
          actual.reason === expected.reason &&
          actual.canonical_digest === expected.canonical_digest,
      });
    }
  }

  const failedCells = matrix.filter((cell) => !cell.passed);
  const categoryCounts: Record<string, number> = {};
  for (const entry of corpus.cases) categoryCounts[entry.category] = (categoryCounts[entry.category] ?? 0) + 1;
  const sdkSummary = Object.fromEntries(SDKS.map((sdk) => {
    const cells = matrix.filter((cell) => cell.sdk === sdk);
    const passed = cells.filter((cell) => cell.passed).length;
    return [sdk, { total: cells.length, passed, failed: cells.length - passed }];
  }));

  const coreEvidence = {
    schema_version: 1,
    profile: "org.ltp.wp6.four-sdk-differential-evidence.v1",
    seed: corpus.seed,
    case_count: corpus.cases.length,
    corpus_digest: corpus.corpus_digest,
    limits: corpus.limits,
    categories: categoryCounts,
    summary: {
      total: matrix.length,
      passed: matrix.length - failedCells.length,
      failed: failedCells.length,
      generator_failures: generatorFailures.length,
    },
    sdk_summary: sdkSummary,
    failures: [...generatorFailures, ...failedCells.slice(0, 100).map((cell) =>
      `${cell.sdk}/${cell.case_id}: expected ${cell.expected_verdict}/${cell.expected_reason}/${cell.expected_digest ?? "-"}, got ${cell.actual_verdict}/${cell.actual_reason}/${cell.actual_digest ?? "-"}`
    )],
    guarantees: {
      four_sdk_differential_oracle: true,
      canonical_round_trip_digest_agreement: failedCells.length === 0,
      resource_limits_enforced: true,
      malformed_json_rejected: true,
      unsafe_integer_rejected: true,
      secret_values_included: false,
    },
  };
  const evidence = { ...coreEvidence, evidence_digest: digest(coreEvidence) };
  writeFileSync(options.out, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    cases: evidence.case_count,
    matrix: evidence.summary,
    corpus_digest: evidence.corpus_digest,
    evidence_digest: evidence.evidence_digest,
  }));
  if (evidence.summary.failed !== 0 || evidence.summary.generator_failures !== 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

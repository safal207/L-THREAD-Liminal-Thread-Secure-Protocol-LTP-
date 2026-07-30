import { spawn } from "child_process";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { ReferenceEvidenceRecord, startReferenceServer } from "../../../tools/reference-server/server";

const SECRET = "ltp-reference-long-term-secret";
const SDKS = ["javascript", "python", "rust", "elixir"] as const;
type Sdk = typeof SDKS[number];

interface AdapterResult {
  schema_version: number;
  sdk: Sdk;
  client_id: string;
  protocol_version: string;
  thread_id: string;
  session_id: string;
  actions: string[];
}

interface MatrixCell {
  sdk: Sdk;
  scenario_id: string;
  expected: string;
  actual: string;
  passed: boolean;
  frame_digest?: string;
  state_digest?: string;
  reason_code?: string;
}

interface CommandSpec {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

const EXPECTED_ACTIONS = [
  "fresh-handshake",
  "business",
  "ping-pong",
  "encrypted",
  "invalid-signature",
  "stale-timestamp",
  "replayed-nonce",
  "broken-chain",
  "same-session-resume",
  "post-resume",
];

function commandFor(sdk: Sdk): CommandSpec {
  switch (sdk) {
    case "javascript":
      return {
        command: "pnpm",
        args: ["exec", "ts-node", "tests/e2e/four-sdk/javascript_adapter.ts"],
      };
    case "python":
      return {
        command: "python",
        args: ["tests/e2e/four-sdk/python_adapter.py"],
        env: { PYTHONPATH: resolve("sdk/python") },
      };
    case "rust":
      return {
        command: "cargo",
        args: [
          "test",
          "--manifest-path",
          "sdk/rust/ltp-client/Cargo.toml",
          "--features",
          "reference-interop",
          "client::reference_interop_tests::reference_server_interop",
          "--",
          "--nocapture",
          "--test-threads=1",
        ],
      };
    case "elixir":
      return {
        command: "mix",
        args: ["run", "../../tests/e2e/four-sdk/elixir_adapter.exs"],
        cwd: resolve("sdk/elixir"),
      };
  }
}

async function runProcess(spec: CommandSpec, env: NodeJS.ProcessEnv): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd || process.cwd(),
      env: { ...process.env, ...env, ...spec.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.once("error", rejectPromise);
    child.once("close", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(
          `${spec.command} ${spec.args.join(" ")} exited ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        ));
      }
    });
  });
}

function findEvidence(
  evidence: ReferenceEvidenceRecord[],
  sdk: Sdk,
  predicate: (record: ReferenceEvidenceRecord) => boolean,
): ReferenceEvidenceRecord | undefined {
  return evidence.find((record) => record.client_id === `wp2-${sdk}` && predicate(record));
}

function cell(
  sdk: Sdk,
  scenarioId: string,
  expected: string,
  evidence: ReferenceEvidenceRecord | undefined,
): MatrixCell {
  const actual = evidence
    ? `${evidence.verdict}:${evidence.reason_code}`
    : "MISSING_EVIDENCE";
  return {
    sdk,
    scenario_id: scenarioId,
    expected,
    actual,
    passed: actual === expected,
    frame_digest: evidence?.frame_digest,
    state_digest: evidence?.state_digest,
    reason_code: evidence?.reason_code,
  };
}

function buildSdkMatrix(sdk: Sdk, evidence: ReferenceEvidenceRecord[]): MatrixCell[] {
  return [
    cell(sdk, "fresh-handshake", "ACCEPTED:HANDSHAKE_INIT_ACCEPTED", findEvidence(
      evidence, sdk, (r) => r.direction === "inbound" && r.frame_type === "handshake_init" && r.verdict === "ACCEPTED",
    )),
    cell(sdk, "business", "ACCEPTED:SECURITY_PIPELINE_ACCEPTED", findEvidence(
      evidence, sdk, (r) => r.direction === "inbound" && r.scenario_id === `${sdk}:business`,
    )),
    cell(sdk, "ping-pong", "ACCEPTED:SECURITY_PIPELINE_ACCEPTED", findEvidence(
      evidence, sdk, (r) => r.direction === "inbound" && r.frame_type === "ping" && r.verdict === "ACCEPTED",
    )),
    cell(sdk, "encrypted", "ACCEPTED:SECURITY_PIPELINE_ACCEPTED", findEvidence(
      evidence, sdk, (r) => r.direction === "inbound" && r.scenario_id === `${sdk}:encrypted`,
    )),
    cell(sdk, "invalid-signature", "REJECTED:INVALID_SIGNATURE", findEvidence(
      evidence, sdk, (r) => r.direction === "inbound" && r.scenario_id === `${sdk}:invalid-signature`,
    )),
    cell(sdk, "stale-timestamp", "REJECTED:STALE_TIMESTAMP", findEvidence(
      evidence, sdk, (r) => r.direction === "inbound" && r.scenario_id === `${sdk}:stale-timestamp`,
    )),
    cell(sdk, "replayed-nonce", "REJECTED:REPLAYED_NONCE", findEvidence(
      evidence, sdk, (r) => r.direction === "inbound" && r.scenario_id === `${sdk}:replayed-nonce`,
    )),
    cell(sdk, "broken-chain", "REJECTED:BROKEN_HASH_CHAIN", findEvidence(
      evidence, sdk, (r) => r.direction === "inbound" && r.scenario_id === `${sdk}:broken-chain`,
    )),
    cell(sdk, "same-session-resume", "ACCEPTED:HANDSHAKE_RESUME_ACCEPTED", findEvidence(
      evidence, sdk, (r) => r.direction === "inbound" && r.frame_type === "handshake_resume" && r.verdict === "ACCEPTED",
    )),
    cell(sdk, "post-resume", "ACCEPTED:SECURITY_PIPELINE_ACCEPTED", findEvidence(
      evidence, sdk, (r) => r.direction === "inbound" && r.scenario_id === `${sdk}:post-resume`,
    )),
  ];
}

function renderMarkdown(matrix: MatrixCell[], adapters: AdapterResult[]): string {
  const lines = [
    "# LTP Four-SDK Wire Interoperability",
    "",
    "> Generated from `artifacts/four-sdk-interoperability.json`. Verdicts come from the independent reference server, not from SDK self-reporting.",
    "",
    "| Scenario | JavaScript | Python | Rust | Elixir |",
    "|---|---|---|---|---|",
  ];
  for (const scenario of EXPECTED_ACTIONS) {
    const values = SDKS.map((sdk) => {
      const value = matrix.find((entry) => entry.sdk === sdk && entry.scenario_id === scenario);
      return value?.passed ? "PASS" : `FAIL (${value?.actual || "missing"})`;
    });
    lines.push(`| ${scenario} | ${values.join(" | ")} |`);
  }
  lines.push("", "## Negotiated wire versions", "");
  for (const adapter of adapters) {
    lines.push(`- **${adapter.sdk}:** \`${adapter.protocol_version}\``);
  }
  lines.push(
    "",
    "## Interpretation",
    "",
    "A PASS means the native SDK process completed the action and the independent server recorded the expected accepted or rejected protocol boundary with frame/state digests.",
    "Package versions remain synchronized at `0.6.0-alpha.3`; current wire versions are `0.3` for JavaScript/Python and `0.6` for Rust/Elixir. Formal convergence and migration policy are tracked by #504.",
    "",
  );
  return lines.join("\n");
}

async function main(): Promise<void> {
  const artifactDir = resolve("artifacts/four-sdk");
  mkdirSync(artifactDir, { recursive: true });
  const server = await startReferenceServer({
    seed: "wp2-four-sdk",
    longTermSecret: SECRET,
    supportedProtocolVersions: ["0.3", "0.6"],
  });
  const adapters: AdapterResult[] = [];

  try {
    for (const sdk of SDKS) {
      const outputPath = resolve(artifactDir, `${sdk}.json`);
      const spec = commandFor(sdk);
      await runProcess(spec, {
        LTP_REFERENCE_URL: server.url,
        LTP_REFERENCE_SECRET: SECRET,
        LTP_ADAPTER_OUTPUT: outputPath,
      });
      const adapter = JSON.parse(readFileSync(outputPath, "utf8")) as AdapterResult;
      if (adapter.sdk !== sdk || adapter.client_id !== `wp2-${sdk}`) {
        throw new Error(`invalid ${sdk} adapter identity`);
      }
      if (JSON.stringify(adapter.actions) !== JSON.stringify(EXPECTED_ACTIONS)) {
        throw new Error(`${sdk} action catalog drift: ${JSON.stringify(adapter.actions)}`);
      }
      adapters.push(adapter);
    }
  } finally {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    await server.close();
  }

  const evidence = server.getEvidence();
  const matrix = SDKS.flatMap((sdk) => buildSdkMatrix(sdk, evidence));
  const passed = matrix.filter((entry) => entry.passed).length;
  const report = {
    schema_version: 1,
    profile: "ltp-four-sdk-wire-v1",
    server: "independent-reference-server",
    summary: { total: matrix.length, passed, failed: matrix.length - passed },
    adapters,
    matrix,
    evidence,
  };
  const jsonPath = resolve("artifacts/four-sdk-interoperability.json");
  const markdownPath = resolve("docs/production/FOUR_SDK_INTEROPERABILITY.md");
  mkdirSync(dirname(jsonPath), { recursive: true });
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(matrix, adapters), "utf8");

  console.log(JSON.stringify(report.summary));
  if (report.summary.failed !== 0) {
    for (const failure of matrix.filter((entry) => !entry.passed)) {
      console.error(`${failure.sdk}/${failure.scenario_id}: expected ${failure.expected}, got ${failure.actual}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

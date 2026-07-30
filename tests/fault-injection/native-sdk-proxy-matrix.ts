import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { startFaultProxy } from "../../tools/fault-injection/proxy";
import {
  ReferenceEvidenceRecord,
  startReferenceServer,
} from "../../tools/reference-server/server";

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

interface CommandSpec {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs: number;
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

const EXPECTED_NEGATIVE_REASONS = [
  "INVALID_SIGNATURE",
  "STALE_TIMESTAMP",
  "REPLAYED_NONCE",
  "BROKEN_HASH_CHAIN",
];

function commandFor(sdk: Sdk): CommandSpec {
  switch (sdk) {
    case "javascript":
      return {
        command: "pnpm",
        args: ["exec", "ts-node", "tests/e2e/four-sdk/javascript_adapter.ts"],
        timeoutMs: 60_000,
      };
    case "python":
      return {
        command: "python",
        args: ["tests/e2e/four-sdk/python_adapter.py"],
        env: { PYTHONPATH: resolve("sdk/python") },
        timeoutMs: 60_000,
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
        timeoutMs: 180_000,
      };
    case "elixir":
      return {
        command: "mix",
        args: ["run", "../../tests/e2e/four-sdk/elixir_adapter.exs"],
        cwd: resolve("sdk/elixir"),
        timeoutMs: 90_000,
      };
  }
}

async function runProcess(spec: CommandSpec, env: NodeJS.ProcessEnv): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd ?? process.cwd(),
      env: { ...process.env, ...env, ...spec.env },
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
    child.once("error", finish);
    child.once("close", (code) => {
      if (code === 0) finish();
      else finish(new Error(`${label} exited ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    });
  });
}

function evidenceForClient(
  evidence: ReferenceEvidenceRecord[],
  sdk: Sdk,
): ReferenceEvidenceRecord[] {
  return evidence.filter((record) => record.client_id === `wp2-${sdk}`);
}

function validateServerEvidence(evidence: ReferenceEvidenceRecord[], sdk: Sdk): void {
  const rows = evidenceForClient(evidence, sdk);
  const handshake = rows.some(
    (record) => record.frame_type === "handshake_init" && record.verdict === "ACCEPTED",
  );
  const resume = rows.some(
    (record) => record.frame_type === "handshake_resume" && record.verdict === "ACCEPTED",
  );
  const acceptedScenarios = [
    `${sdk}:business`,
    `${sdk}:encrypted`,
    `${sdk}:post-resume`,
  ].every((scenarioId) => rows.some(
    (record) =>
      record.scenario_id === scenarioId &&
      record.verdict === "ACCEPTED" &&
      record.reason_code === "SECURITY_PIPELINE_ACCEPTED",
  ));
  const negativeReasons = EXPECTED_NEGATIVE_REASONS.every((reason) =>
    rows.some((record) => record.verdict === "REJECTED" && record.reason_code === reason)
  );
  if (!handshake || !resume || !acceptedScenarios || !negativeReasons) {
    throw new Error(`${sdk} reference evidence incomplete`);
  }
}

async function main(): Promise<void> {
  const artifactDir = resolve("artifacts/wp3-native-sdk-proxy");
  mkdirSync(artifactDir, { recursive: true });
  const server = await startReferenceServer({
    seed: "wp3-native-sdk-proxy",
    longTermSecret: SECRET,
    supportedProtocolVersions: ["0.3", "0.6"],
  });
  const proxy = await startFaultProxy({
    upstreamUrl: server.url,
    seed: "wp3-native-sdk-proxy",
    faultSequence: ["FRAGMENT"],
  });
  const adapters: AdapterResult[] = [];

  try {
    for (const sdk of SDKS) {
      const outputPath = resolve(artifactDir, `${sdk}.json`);
      await runProcess(commandFor(sdk), {
        LTP_REFERENCE_URL: proxy.urlFor(`wp2-${sdk}`),
        LTP_REFERENCE_SECRET: SECRET,
        LTP_ADAPTER_OUTPUT: outputPath,
      });
      const adapter = JSON.parse(readFileSync(outputPath, "utf8")) as AdapterResult;
      if (adapter.sdk !== sdk || adapter.client_id !== `wp2-${sdk}`) {
        throw new Error(`${sdk} adapter identity mismatch`);
      }
      if (JSON.stringify(adapter.actions) !== JSON.stringify(EXPECTED_ACTIONS)) {
        throw new Error(`${sdk} action catalog drift: ${JSON.stringify(adapter.actions)}`);
      }
      adapters.push(adapter);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  } finally {
    await proxy.close();
    await server.close();
  }

  const serverEvidence = server.getEvidence();
  for (const sdk of SDKS) validateServerEvidence(serverEvidence, sdk);
  const proxyEvidence = proxy.getEvidence();
  for (const sdk of SDKS) {
    const key = `wp2-${sdk}`;
    const rows = proxyEvidence.filter((record) => record.client_key === key);
    if (!rows.some((record) => record.fault === "FRAGMENT" && record.verdict === "FORWARDED")) {
      throw new Error(`${sdk} has no live fragmented proxy evidence`);
    }
    if (rows.some((record) => record.verdict === "REJECTED")) {
      throw new Error(`${sdk} proxy unexpectedly rejected an active owner`);
    }
  }

  const expectedVerdicts = SDKS.length * EXPECTED_ACTIONS.length;
  const raw = JSON.stringify({ adapters, proxyEvidence, serverEvidence });
  for (const forbidden of ["macKey", "encryptionKey", "privateKey", "secretKey", "longTermSecret"]) {
    if (raw.includes(forbidden)) throw new Error(`native SDK proxy evidence leaked ${forbidden}`);
  }

  const report = {
    schema_version: 1,
    profile: "org.ltp.production.wp3.native-sdk-proxy.v0.1",
    proxy_fault: "FRAGMENT",
    summary: {
      sdks: SDKS.length,
      scenarios_per_sdk: EXPECTED_ACTIONS.length,
      total: expectedVerdicts,
      passed: expectedVerdicts,
      failed: 0,
    },
    adapters,
    proxy_evidence: proxyEvidence,
    reference_evidence: serverEvidence,
  };
  const outputPath = resolve("artifacts/wp3-native-sdk-proxy.json");
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report.summary));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

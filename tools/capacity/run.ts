import { spawn, execFileSync } from "child_process";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { cpus, totalmem, platform, arch, release } from "os";
import { dirname, resolve } from "path";
import { performance } from "perf_hooks";
import WebSocket from "ws";
import {
  DeterministicClock,
  ReferenceScenarioClient,
} from "../reference-server/scenarios";
import { startReferenceServer } from "../reference-server/server";
import { parseGnuTime, quantiles, renderLineSvg, TimeSample } from "./metrics";

const SECRET = "ltp-reference-long-term-secret";
const SDKS = ["javascript", "python", "rust", "elixir"] as const;
type Sdk = typeof SDKS[number];

type ProfileName = "pr" | "soak";

interface CapacityProfile {
  name: ProfileName;
  concurrentSessions: number;
  framesPerSession: number;
  sdkMeasuredRounds: number;
  largePayloadBytes: number;
  maxRssGrowthMiB: number;
}

const PROFILES: Record<ProfileName, CapacityProfile> = {
  pr: {
    name: "pr",
    concurrentSessions: 8,
    framesPerSession: 24,
    sdkMeasuredRounds: 2,
    largePayloadBytes: 96 * 1024,
    maxRssGrowthMiB: 192,
  },
  soak: {
    name: "soak",
    concurrentSessions: 32,
    framesPerSession: 256,
    sdkMeasuredRounds: 4,
    largePayloadBytes: 192 * 1024,
    maxRssGrowthMiB: 512,
  },
};

interface CommandSpec {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs: number;
}

interface TimedProcessResult extends TimeSample {
  stdout: string;
  stderr: string;
}

function profileFromEnvironment(): CapacityProfile {
  const requested = (process.env.LTP_CAPACITY_PROFILE || "pr") as ProfileName;
  const profile = PROFILES[requested];
  if (!profile) throw new Error(`unknown LTP_CAPACITY_PROFILE: ${requested}`);
  return profile;
}

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

async function runTimedProcess(
  spec: CommandSpec,
  env: NodeJS.ProcessEnv,
): Promise<TimedProcessResult> {
  return new Promise<TimedProcessResult>((resolvePromise, rejectPromise) => {
    const started = performance.now();
    const child = spawn(
      "/usr/bin/time",
      ["-f", "__WP4_TIME__:%U:%S:%M", spec.command, ...spec.args],
      {
        cwd: spec.cwd || process.cwd(),
        env: { ...process.env, ...env, ...spec.env },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) rejectPromise(error);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`${spec.command} timed out after ${spec.timeoutMs}ms`));
    }, spec.timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", (error) => finish(error));
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        rejectPromise(new Error(
          `${spec.command} exited ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        ));
        return;
      }
      const resources = parseGnuTime(stderr);
      resolvePromise({
        ...resources,
        wallMs: performance.now() - started,
        stdout,
        stderr,
      });
    });
  });
}

function runtimeVersion(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, { encoding: "utf8" }).trim().split("\n")[0];
  } catch (error) {
    return `unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function errorCode(frame: any): string {
  const payload = frame?.payload;
  return payload && typeof payload.error_code === "string"
    ? payload.error_code
    : "UNKNOWN_ERROR";
}

async function runHighRateProfile(profile: CapacityProfile) {
  const clock = new DeterministicClock(1_900_000_000_000);
  const maxSeenNoncesPerSession = Math.max(512, profile.framesPerSession + 64);
  const server = await startReferenceServer({
    seed: `wp4-${profile.name}`,
    clock: clock.now,
    longTermSecret: SECRET,
    capacityLimits: {
      maxFrameBytes: 256 * 1024,
      maxPendingSendBytes: 2 * 1024 * 1024,
      maxConcurrentSessions: profile.concurrentSessions + 8,
      maxSeenNoncesPerSession,
      maxEvidenceRecords: Math.max(20_000, profile.concurrentSessions * profile.framesPerSession * 4),
      maxReconnectsPerWindow: 4,
      reconnectWindowMs: 10_000,
      maxSessionIdleMs: 60_000,
    },
  });
  const clients = Array.from({ length: profile.concurrentSessions }, (_, index) =>
    new ReferenceScenarioClient(server.url, `wp4-load-${index}`, clock));
  const memoryRssMiB: number[] = [process.memoryUsage().rss / 1024 / 1024];
  const latenciesMs: number[] = [];
  let accepted = 0;
  const cpuStart = process.cpuUsage();
  const wallStart = performance.now();

  try {
    await Promise.all(clients.map(async (client) => {
      await client.connect();
      const response = await client.freshHandshake();
      if (response.type !== "handshake_ack") {
        throw new Error(`load handshake rejected: ${response.reason}`);
      }
    }));
    memoryRssMiB.push(process.memoryUsage().rss / 1024 / 1024);

    await Promise.all(clients.map(async (client, clientIndex) => {
      for (let messageIndex = 0; messageIndex < profile.framesPerSession; messageIndex += 1) {
        const started = performance.now();
        const frame = client.buildFrame("event", {
          kind: "wp4_load",
          data: {
            scenario_id: `load-${clientIndex}-${messageIndex}`,
            client_index: clientIndex,
            message_index: messageIndex,
          },
        }, { encrypted: messageIndex % 2 === 1 });
        client.sendBuilt(frame);
        await client.receiveSecure("state_update");
        latenciesMs.push(performance.now() - started);
        accepted += 1;
        if (messageIndex % 16 === 0) {
          memoryRssMiB.push(process.memoryUsage().rss / 1024 / 1024);
        }
      }
    }));

    const largeStarted = performance.now();
    const largeFrame = clients[0].buildFrame("event", {
      kind: "wp4_large_payload",
      data: {
        scenario_id: "large-payload-at-configured-range",
        blob: "x".repeat(profile.largePayloadBytes),
      },
    }, { encrypted: true });
    clients[0].sendBuilt(largeFrame);
    await clients[0].receiveSecure("state_update");
    const largePayloadLatencyMs = performance.now() - largeStarted;
    accepted += 1;

    const reconnectClient = clients[0];
    const reconnectResults: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      try {
        await reconnectClient.resume();
        reconnectResults.push("ACCEPTED");
      } catch (error) {
        reconnectResults.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (!reconnectResults.at(-1)?.includes("reconnect_rate_limit")) {
      throw new Error(`reconnect storm did not fail closed: ${JSON.stringify(reconnectResults)}`);
    }

    const wallMs = performance.now() - wallStart;
    const cpu = process.cpuUsage(cpuStart);
    memoryRssMiB.push(process.memoryUsage().rss / 1024 / 1024);
    const rssGrowthMiB = Math.max(...memoryRssMiB) - memoryRssMiB[0];
    if (rssGrowthMiB > profile.maxRssGrowthMiB) {
      throw new Error(
        `RSS growth ${rssGrowthMiB.toFixed(2)} MiB exceeds profile ceiling ${profile.maxRssGrowthMiB} MiB`,
      );
    }

    const capacity = server.getCapacitySnapshot();
    if (capacity.nonceEntries > capacity.activeSessions * maxSeenNoncesPerSession) {
      throw new Error("nonce cache exceeded the configured per-session bound");
    }
    const attempted = profile.concurrentSessions * profile.framesPerSession + 1;
    if (accepted !== attempted) {
      throw new Error(`accepted ${accepted}/${attempted} secured workload frames`);
    }

    return {
      workload: {
        concurrent_sessions: profile.concurrentSessions,
        frames_per_session: profile.framesPerSession,
        attempted_frames: attempted,
        accepted_frames: accepted,
        failure_rate: 0,
        metadata_encryption: "alternating enabled/disabled",
        security_verification_enabled: true,
      },
      latency_ms: quantiles(latenciesMs),
      large_payload: {
        payload_bytes: profile.largePayloadBytes,
        latency_ms: Number(largePayloadLatencyMs.toFixed(3)),
        accepted: true,
      },
      throughput_frames_per_second: Number((accepted / (wallMs / 1000)).toFixed(3)),
      wall_ms: Number(wallMs.toFixed(3)),
      cpu: {
        user_ms: Number((cpu.user / 1000).toFixed(3)),
        system_ms: Number((cpu.system / 1000).toFixed(3)),
      },
      memory: {
        samples_rss_mib: memoryRssMiB.map((value) => Number(value.toFixed(3))),
        rss_growth_mib: Number(rssGrowthMiB.toFixed(3)),
        ceiling_mib: profile.maxRssGrowthMiB,
      },
      reconnect_storm: {
        attempts: reconnectResults.length,
        outcomes: reconnectResults,
        final_reason_code: "RECONNECT_RATE_LIMIT",
      },
      capacity_snapshot: capacity,
      raw_latency_samples_ms: latenciesMs.map((value) => Number(value.toFixed(6))),
    };
  } finally {
    await Promise.all(clients.map((client) => client.close().catch(() => undefined)));
    await server.close();
  }
}

async function runAbuseProfiles() {
  const clock = new DeterministicClock(1_910_000_000_000);

  const sessionServer = await startReferenceServer({
    seed: "wp4-session-limit",
    clock: clock.now,
    longTermSecret: SECRET,
    capacityLimits: {
      maxConcurrentSessions: 1,
      maxFrameBytes: 64 * 1024,
      maxPendingSendBytes: 128 * 1024,
    },
  });
  const first = new ReferenceScenarioClient(sessionServer.url, "wp4-capacity-a", clock);
  const second = new ReferenceScenarioClient(sessionServer.url, "wp4-capacity-b", clock);
  let sessionReason = "";
  try {
    await first.connect();
    await first.freshHandshake();
    await second.connect();
    const response = await second.freshHandshake();
    sessionReason = response.type === "handshake_reject" ? response.reason : "UNEXPECTED_ACCEPT";
  } finally {
    await first.close().catch(() => undefined);
    await second.close().catch(() => undefined);
    await sessionServer.close();
  }

  const nonceServer = await startReferenceServer({
    seed: "wp4-nonce-limit",
    clock: clock.now,
    longTermSecret: SECRET,
    maxMessageAgeMs: 60_000,
    capacityLimits: {
      maxSeenNoncesPerSession: 2,
      maxFrameBytes: 64 * 1024,
      maxPendingSendBytes: 128 * 1024,
    },
  });
  const nonceClient = new ReferenceScenarioClient(nonceServer.url, "wp4-nonce", clock);
  let nonceReason = "";
  try {
    await nonceClient.connect();
    await nonceClient.freshHandshake();
    for (let index = 0; index < 2; index += 1) {
      const frame = nonceClient.buildFrame("event", {
        kind: "nonce_limit_seed",
        data: { scenario_id: `nonce-seed-${index}` },
      });
      nonceClient.sendBuilt(frame);
      await nonceClient.receiveSecure("state_update");
    }
    const overflow = nonceClient.buildFrame("event", {
      kind: "nonce_limit_overflow",
      data: { scenario_id: "nonce-overflow" },
    });
    nonceClient.sendBuilt(overflow);
    nonceReason = errorCode(await nonceClient.receiveSecure("error"));
  } finally {
    await nonceClient.close().catch(() => undefined);
    await nonceServer.close();
  }

  const frameServer = await startReferenceServer({
    seed: "wp4-frame-limit",
    clock: clock.now,
    longTermSecret: SECRET,
    capacityLimits: {
      maxFrameBytes: 2_048,
      maxPendingSendBytes: 8_192,
    },
  });
  const frameClient = new ReferenceScenarioClient(frameServer.url, "wp4-frame", clock);
  let frameReason = "";
  try {
    await frameClient.connect();
    await frameClient.freshHandshake();
    const oversized = frameClient.buildFrame("event", {
      kind: "oversized",
      data: { scenario_id: "oversized-frame", blob: "x".repeat(8_192) },
    });
    frameClient.sendBuilt(oversized);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
    frameReason = frameServer.getEvidence()
      .find((record) => record.reason_code === "FRAME_TOO_LARGE")
      ?.reason_code || "MISSING_EVIDENCE";
  } finally {
    await frameClient.close().catch(() => undefined);
    await frameServer.close();
  }

  const results = {
    session_capacity: sessionReason,
    nonce_cache: nonceReason,
    oversized_frame: frameReason,
    expected: {
      session_capacity: "session_capacity_limit",
      nonce_cache: "NONCE_CACHE_LIMIT",
      oversized_frame: "FRAME_TOO_LARGE",
    },
  };
  if (
    results.session_capacity !== results.expected.session_capacity ||
    results.nonce_cache !== results.expected.nonce_cache ||
    results.oversized_frame !== results.expected.oversized_frame
  ) {
    throw new Error(`capacity abuse profile mismatch: ${JSON.stringify(results)}`);
  }
  return results;
}

async function runSdkProfiles(profile: CapacityProfile) {
  const server = await startReferenceServer({
    seed: `wp4-sdk-${profile.name}`,
    longTermSecret: SECRET,
    supportedProtocolVersions: ["0.3", "0.6"],
    capacityLimits: {
      maxConcurrentSessions: 128,
      maxSeenNoncesPerSession: 512,
      maxEvidenceRecords: 30_000,
    },
  });
  const outputDir = resolve("artifacts/wp4/sdk");
  mkdirSync(outputDir, { recursive: true });
  const reports: Record<string, unknown> = {};

  try {
    for (const sdk of SDKS) {
      const spec = commandFor(sdk);
      const rounds: TimedProcessResult[] = [];
      for (let round = -1; round < profile.sdkMeasuredRounds; round += 1) {
        const outputPath = resolve(outputDir, `${sdk}-${round < 0 ? "warmup" : round}.json`);
        const result = await runTimedProcess(spec, {
          LTP_REFERENCE_URL: server.url,
          LTP_REFERENCE_SECRET: SECRET, // fcrp: fixture
          LTP_ADAPTER_OUTPUT: outputPath,
        });
        const adapter = JSON.parse(readFileSync(outputPath, "utf8")) as {
          sdk: string;
          actions: string[];
          protocol_version: string;
        };
        if (adapter.sdk !== sdk || adapter.actions.length !== 10) {
          throw new Error(`invalid ${sdk} capacity adapter output`);
        }
        if (round >= 0) rounds.push(result);
      }
      const actionCount = rounds.length * 10;
      const totalWallSeconds = rounds.reduce((sum, round) => sum + round.wallMs, 0) / 1000;
      const perActionMs = rounds.map((round) => round.wallMs / 10);
      reports[sdk] = {
        measured_rounds: rounds.length,
        secured_actions_per_round: 10,
        scenario_latency_ms_per_action: quantiles(perActionMs),
        process_wall_ms: quantiles(rounds.map((round) => round.wallMs)),
        process_user_cpu_seconds: quantiles(rounds.map((round) => round.userCpuSeconds)),
        process_system_cpu_seconds: quantiles(rounds.map((round) => round.systemCpuSeconds)),
        process_max_rss_kib: quantiles(rounds.map((round) => round.maxRssKiB), 0),
        throughput_secured_actions_per_second: Number((actionCount / totalWallSeconds).toFixed(3)),
        process_failures: 0,
        security_verification_enabled: true,
        note: "Measured scenario includes authenticated handshake, business/control/encrypted frames, fail-closed abuse checks and same-session resume. Toolchain startup is included; one warmup round is excluded.",
      };
    }
  } finally {
    await server.close();
  }
  return reports;
}

function renderMarkdown(report: any): string {
  const rows = SDKS.map((sdk) => {
    const value = report.sdk_profiles[sdk];
    return `| ${sdk} | ${value.scenario_latency_ms_per_action.p50} | ${value.scenario_latency_ms_per_action.p95} | ${value.scenario_latency_ms_per_action.p99} | ${value.throughput_secured_actions_per_second} | ${value.process_max_rss_kib.max} |`;
  });
  return [
    "# WP4 Capacity and Resource Evidence",
    "",
    `Profile: \`${report.profile.name}\``,
    "",
    "> These values are measured ranges for the recorded CI/runtime context. They are not universal deployment claims.",
    "",
    "## High-rate secured workload",
    "",
    `- Concurrent sessions: **${report.high_rate.workload.concurrent_sessions}**`,
    `- Accepted frames: **${report.high_rate.workload.accepted_frames}/${report.high_rate.workload.attempted_frames}**`,
    `- Throughput: **${report.high_rate.throughput_frames_per_second} frames/s**`,
    `- Latency P50/P95/P99: **${report.high_rate.latency_ms.p50}/${report.high_rate.latency_ms.p95}/${report.high_rate.latency_ms.p99} ms**`,
    `- RSS growth: **${report.high_rate.memory.rss_growth_mib} MiB** (gate ${report.high_rate.memory.ceiling_mib} MiB)`,
    `- Metadata encryption: **${report.high_rate.workload.metadata_encryption}**`,
    `- Security verification: **enabled**`,
    "",
    "## Native SDK process profiles",
    "",
    "| SDK | P50 ms/action | P95 | P99 | actions/s | max RSS KiB |",
    "|---|---:|---:|---:|---:|---:|",
    ...rows,
    "",
    "## Fail-closed abuse limits",
    "",
    `- Session capacity: \`${report.abuse.session_capacity}\``,
    `- Nonce cache: \`${report.abuse.nonce_cache}\``,
    `- Oversized frame: \`${report.abuse.oversized_frame}\``,
    `- Reconnect storm: \`${report.high_rate.reconnect_storm.final_reason_code}\``,
    "",
    "See `capacity-report.json`, `latency.svg`, `memory-rss.svg` and `latency-samples.jsonl` in the retained workflow artifact.",
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  const profile = profileFromEnvironment();
  const artifactDir = resolve("artifacts/wp4");
  mkdirSync(artifactDir, { recursive: true });

  const highRate = await runHighRateProfile(profile);
  const abuse = await runAbuseProfiles();
  const sdkProfiles = await runSdkProfiles(profile);
  const report = {
    schema_version: 1,
    profile,
    interpretation: "Measured range for this exact source, workflow and runtime context; not a universal capacity claim.",
    source_sha: process.env.LTP_SOURCE_SHA || process.env.GITHUB_SHA || "local",
    workflow_run: process.env.GITHUB_RUN_ID || null,
    hardware_runtime_context: {
      os: { platform: platform(), release: release(), arch: arch() },
      cpu: { model: cpus()[0]?.model || "unknown", logical_cores: cpus().length },
      total_memory_mib: Number((totalmem() / 1024 / 1024).toFixed(0)),
      runtimes: {
        node: process.version,
        python: runtimeVersion("python", ["--version"]),
        rust: runtimeVersion("rustc", ["--version"]),
        cargo: runtimeVersion("cargo", ["--version"]),
        elixir: runtimeVersion("elixir", ["--version"]),
      },
    },
    high_rate: highRate,
    abuse,
    sdk_profiles: sdkProfiles,
    exit: {
      passed: true,
      security_verification_enabled: true,
      no_unbounded_memory_growth: highRate.memory.rss_growth_mib <= highRate.memory.ceiling_mib,
      replay_cache_bounded: highRate.capacity_snapshot.nonceEntries <=
        highRate.capacity_snapshot.activeSessions * highRate.capacity_snapshot.limits.maxSeenNoncesPerSession,
      stable_reason_codes_verified: true,
    },
  };

  writeFileSync(
    resolve(artifactDir, "capacity-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(resolve(artifactDir, "capacity-report.md"), renderMarkdown(report), "utf8");
  writeFileSync(
    resolve(artifactDir, "latency-samples.jsonl"),
    highRate.raw_latency_samples_ms.map((latency_ms: number, index: number) =>
      JSON.stringify({ index, latency_ms })).join("\n") + "\n",
    "utf8",
  );
  writeFileSync(
    resolve(artifactDir, "latency.svg"),
    renderLineSvg("Secured round-trip latency", highRate.raw_latency_samples_ms, "ms"),
    "utf8",
  );
  writeFileSync(
    resolve(artifactDir, "memory-rss.svg"),
    renderLineSvg("Harness RSS", highRate.memory.samples_rss_mib, "MiB"),
    "utf8",
  );
  console.log(JSON.stringify({
    profile: profile.name,
    accepted: highRate.workload.accepted_frames,
    throughput: highRate.throughput_frames_per_second,
    p99_ms: highRate.latency_ms.p99,
    rss_growth_mib: highRate.memory.rss_growth_mib,
  }));
}

main().catch((error) => {
  const artifactDir = resolve("artifacts/wp4");
  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(resolve(artifactDir, "failure.txt"), `${error instanceof Error ? error.stack : String(error)}\n`);
  console.error(error);
  process.exitCode = 1;
});

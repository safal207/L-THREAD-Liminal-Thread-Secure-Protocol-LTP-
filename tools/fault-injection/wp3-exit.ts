import { ChildProcess, fork } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import WebSocket from "ws";
import { startFaultProxy } from "./proxy";
import {
  deriveSessionKeys,
  deriveSharedSecret,
  generateEcdhKeyPair,
  generateNonce,
  hashEnvelope,
  LtpEnvelope,
  REFERENCE_PROTOCOL_VERSION,
  REFERENCE_SUBPROTOCOL,
  SessionKeys,
  sha256,
  signEcdhPublicKey,
  signEnvelope,
  verifyEcdhPublicKey,
} from "../reference-server/protocol";
import {
  ReferenceEvidenceRecord,
  startReferenceServer,
} from "../reference-server/server";

const SECRET = "ltp-reference-long-term-secret";
const TIMEOUT_MS = 20_000;

interface ChildReady {
  type: "ready";
  process_id: number;
  url: string;
  restore_status: "EMPTY" | "RESTORED" | "RESET";
  restored_sessions: number;
}

interface CrashReport {
  type: "acknowledged";
  process_id: number;
  client_id: string;
  thread_id: string;
  session_id: string;
  nonce: string;
  raw_frame: string;
  committed_frame_hash: string;
  stale_client_state: {
    thread_id: string;
    session_id: string;
    last_sent_hash: string | null;
    last_received_hash: string | null;
  };
}

interface SnapshotWritten {
  type: "snapshot_written";
  path: string;
  checksum: string;
  session_count: number;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function waitForMessage<T extends { type: string }>(
  child: ChildProcess,
  type: T["type"],
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      cleanup();
      rejectPromise(new Error(`timeout waiting for child message ${type}`));
    }, timeoutMs);
    const onMessage = (message: any) => {
      if (message?.type !== type) return;
      cleanup();
      resolvePromise(message as T);
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup();
      rejectPromise(new Error(`child exited before ${type}: code=${code} signal=${signal}`));
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.off("message", onMessage);
      child.off("exit", onExit);
    };
    child.on("message", onMessage);
    child.on("exit", onExit);
  });
}

function spawnTypeScript(modulePath: string, env: NodeJS.ProcessEnv): ChildProcess {
  const child = fork(resolve(modulePath), [], {
    execArgv: ["-r", "ts-node/register"],
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

async function killAndWait(child: ChildProcess, signal: NodeJS.Signals = "SIGKILL"): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolvePromise) => child.once("exit", () => resolvePromise()));
  child.kill(signal);
  await exited;
}

async function startServerProcess(snapshotPath: string, seed: string): Promise<{
  child: ChildProcess;
  ready: ChildReady;
}> {
  const child = spawnTypeScript("tools/fault-injection/reference-server-process.ts", {
    LTP_SERVER_SNAPSHOT: snapshotPath,
    LTP_SERVER_SEED: seed,
    LTP_REFERENCE_SECRET: SECRET,
  });
  const ready = await waitForMessage<ChildReady>(child, "ready");
  return { child, ready };
}

async function childRequest<T extends { type: string }>(
  child: ChildProcess,
  request: Record<string, unknown>,
  responseType: T["type"],
): Promise<T> {
  const response = waitForMessage<T>(child, responseType);
  child.send(request);
  return response;
}

class RawAuthenticatedClient {
  private socket: WebSocket | null = null;
  private queue: string[] = [];
  private waiters: Array<(value: string) => void> = [];
  private keys: SessionKeys | null = null;
  private keyGeneration = 0;
  threadId = "";
  sessionId = "";
  lastSentHash: string | null = null;

  constructor(
    private readonly url: string,
    readonly clientId: string,
    private readonly seed: string,
  ) {}

  async connect(): Promise<void> {
    const socket = new WebSocket(this.url, REFERENCE_SUBPROTOCOL);
    this.socket = socket;
    socket.on("message", (data) => {
      const raw = data.toString();
      const waiter = this.waiters.shift();
      if (waiter) waiter(raw); else this.queue.push(raw);
    });
    await new Promise<void>((resolvePromise, rejectPromise) => {
      socket.once("open", resolvePromise);
      socket.once("error", rejectPromise);
    });
  }

  isOpen(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  async freshHandshake(): Promise<void> {
    await this.connect();
    const response = await this.handshake("handshake_init");
    this.threadId = response.thread_id;
    this.sessionId = response.session_id;
    this.lastSentHash = null;
  }

  async resume(threadId: string, sessionId: string): Promise<void> {
    this.threadId = threadId;
    this.sessionId = sessionId;
    await this.connect();
    const response = await this.handshake("handshake_resume");
    if (!response.resumed || response.thread_id !== threadId || response.session_id !== sessionId) {
      throw new Error("authenticated resume did not preserve the session namespace");
    }
  }

  async sendEvent(options: {
    scenarioId: string;
    nonce?: string;
    prevHash?: string | null;
  }): Promise<{ raw: string; hash: string; nonce: string }> {
    if (!this.keys) throw new Error("session keys are unavailable");
    const timestamp = Date.now();
    const nonce = options.nonce ?? generateNonce(
      this.keys.macKey,
      this.clientId,
      timestamp,
      sha256(`${this.seed}:${options.scenarioId}:${timestamp}`).slice(0, 32),
    );
    const frame: LtpEnvelope = {
      type: "event",
      thread_id: this.threadId,
      session_id: this.sessionId,
      timestamp,
      nonce,
      payload: {
        event_type: "wp3",
        data: { scenario_id: options.scenarioId },
      },
      prev_message_hash: options.prevHash === undefined
        ? this.lastSentHash || undefined
        : options.prevHash || undefined,
      meta: { client_id: this.clientId },
      content_encoding: "json",
    };
    frame.signature = signEnvelope(frame, this.keys.macKey);
    const raw = JSON.stringify(frame);
    const hash = hashEnvelope(frame);
    this.requireSocket().send(raw);
    this.lastSentHash = hash;
    return { raw, hash, nonce };
  }

  async close(): Promise<void> {
    const socket = this.socket;
    this.socket = null;
    if (!socket || socket.readyState === WebSocket.CLOSED) return;
    await new Promise<void>((resolvePromise) => {
      socket.once("close", () => resolvePromise());
      socket.close(1000, "wp3 exit complete");
      setTimeout(() => {
        if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
        resolvePromise();
      }, 250).unref();
    });
  }

  private async handshake(type: "handshake_init" | "handshake_resume"): Promise<any> {
    this.keyGeneration += 1;
    const pair = generateEcdhKeyPair(`${this.seed}:key:${this.keyGeneration}`);
    const timestamp = Date.now();
    const frame: any = {
      type,
      ltp_version: REFERENCE_PROTOCOL_VERSION,
      client_id: this.clientId,
      client_public_key: pair.publicKey,
      client_ecdh_public_key: pair.publicKey,
      client_ecdh_timestamp: timestamp,
      client_ecdh_signature: signEcdhPublicKey(
        pair.publicKey,
        this.clientId,
        timestamp,
        SECRET,
      ),
      key_agreement: {
        algorithm: "secp256r1",
        method: "ecdh",
        hkdf: "sha256",
      },
    };
    if (type === "handshake_resume") {
      frame.thread_id = this.threadId;
      frame.resume_reason = "wp3_exit_race";
    }
    this.requireSocket().send(JSON.stringify(frame));
    const response = JSON.parse(await this.receive());
    if (response.type !== "handshake_ack") {
      throw new Error(`handshake rejected: ${response.reason || response.type}`);
    }
    if (!verifyEcdhPublicKey(
      response.server_ecdh_public_key,
      response.session_id,
      response.server_ecdh_timestamp,
      response.server_ecdh_signature,
      SECRET,
      Date.now(),
    )) {
      throw new Error("server ECDH signature failed");
    }
    this.keys = deriveSessionKeys(
      deriveSharedSecret(pair.privateKey, response.server_ecdh_public_key),
      response.session_id,
    );
    return response;
  }

  private receive(timeoutMs = 8_000): Promise<string> {
    const queued = this.queue.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    return new Promise<string>((resolvePromise, rejectPromise) => {
      const timer = setTimeout(() => rejectPromise(new Error("socket message timeout")), timeoutMs);
      this.waiters.push((raw) => {
        clearTimeout(timer);
        resolvePromise(raw);
      });
    });
  }

  private requireSocket(): WebSocket {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("socket is not open");
    }
    return this.socket;
  }
}

async function pollEvidence(
  child: ChildProcess,
  predicate: (records: ReferenceEvidenceRecord[]) => boolean,
  timeoutMs = 8_000,
): Promise<ReferenceEvidenceRecord[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await childRequest<{ type: "evidence"; evidence: ReferenceEvidenceRecord[] }>(
      child,
      { type: "evidence" },
      "evidence",
    );
    if (predicate(response.evidence)) return response.evidence;
    await delay(25);
  }
  throw new Error("evidence predicate timeout");
}

async function runFaultTimeline(
  fault: "DUPLICATE" | "DELAY" | "REORDER",
): Promise<Record<string, unknown>> {
  const seed = `wp3-exit-${fault.toLowerCase()}`;
  const server = await startReferenceServer({ seed, longTermSecret: SECRET });
  const sequence = fault === "REORDER"
    ? ["SERVER_RESTART", "REORDER", "REORDER"] as const
    : ["SERVER_RESTART", fault] as const;
  const proxy = await startFaultProxy({
    upstreamUrl: server.url,
    seed,
    faultSequence: [...sequence],
  });
  const clientKey = `timeline-${fault.toLowerCase()}`;
  const client = new RawAuthenticatedClient(proxy.urlFor(clientKey), clientKey, seed);

  try {
    await client.freshHandshake();
    if (fault === "DUPLICATE") {
      await client.sendEvent({ scenarioId: "wp3:duplicate" });
      await delay(100);
    } else if (fault === "DELAY") {
      await client.sendEvent({ scenarioId: "wp3:delay" });
      await delay(25);
      proxy.flush(clientKey);
      await delay(100);
    } else {
      const first = await client.sendEvent({ scenarioId: "wp3:reorder-first" });
      await client.sendEvent({ scenarioId: "wp3:reorder-second", prevHash: first.hash });
      await delay(125);
    }

    const evidence = server.getEvidence();
    const proxyEvidence = proxy.getEvidence();
    let terminalReason = "SECURITY_PIPELINE_ACCEPTED";
    if (fault === "DUPLICATE") {
      const duplicateRows = evidence.filter((record) =>
        record.direction === "inbound" && record.scenario_id === "wp3:duplicate"
      );
      const acceptedCount = duplicateRows.filter((record) => record.verdict === "ACCEPTED").length;
      const rejected = duplicateRows.find((record) =>
        record.verdict === "REJECTED" && record.reason_code === "BROKEN_HASH_CHAIN"
      );
      // The first copy commits the exact frame hash. The second identical copy
      // therefore fails the chain check before the later nonce-replay check.
      // This is the earliest deterministic fail-closed gate for a wire duplicate.
      if (acceptedCount !== 1 || !rejected) {
        throw new Error(
          `duplicate timeline expected one acceptance and BROKEN_HASH_CHAIN, got ${JSON.stringify(duplicateRows)}`,
        );
      }
      terminalReason = rejected.reason_code;
    }
    if (fault === "DELAY") {
      const buffered = proxyEvidence.some((record) => record.reason_code === "DELAY");
      const released = proxyEvidence.some((record) => record.reason_code === "DELAY_RELEASED");
      const accepted = evidence.some((record) =>
        record.scenario_id === "wp3:delay" && record.verdict === "ACCEPTED"
      );
      if (!buffered || !released || !accepted) throw new Error("delay timeline incomplete");
    }
    if (fault === "REORDER") {
      const buffered = proxyEvidence.some((record) => record.reason_code === "REORDER_BUFFERED");
      const released = proxyEvidence.some((record) => record.reason_code === "REORDER_RELEASED");
      const broken = evidence.some((record) =>
        record.scenario_id === "wp3:reorder-second" && record.reason_code === "BROKEN_HASH_CHAIN"
      );
      const accepted = evidence.some((record) =>
        record.scenario_id === "wp3:reorder-first" && record.verdict === "ACCEPTED"
      );
      if (!buffered || !released || !broken || !accepted) throw new Error("reorder timeline incomplete");
      terminalReason = "BROKEN_HASH_CHAIN";
    }

    return {
      fault,
      terminal_reason: terminalReason,
      proxy_records: proxyEvidence.length,
      server_records: evidence.length,
      proxy_digest: sha256(JSON.stringify(proxyEvidence)),
      server_digest: sha256(JSON.stringify(evidence)),
    };
  } finally {
    await client.close();
    await proxy.close();
    await server.close();
  }
}

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), "ltp-wp3-exit-"));
  const snapshotPath = join(directory, "reference-server-snapshot.json");
  const corruptPath = join(directory, "reference-server-corrupt.json");
  const outputPath = resolve("artifacts/wp3-exit-evidence.json");
  let serverChild: ChildProcess | null = null;
  let restartedChild: ChildProcess | null = null;
  let crashChild: ChildProcess | null = null;
  let corruptChild: ChildProcess | null = null;

  try {
    const initial = await startServerProcess(snapshotPath, "wp3-exit-server");
    serverChild = initial.child;
    if (initial.ready.restore_status !== "EMPTY") throw new Error("initial server was not empty");

    crashChild = spawnTypeScript("tools/fault-injection/native-crash-client.ts", {
      LTP_REFERENCE_URL: initial.ready.url,
      LTP_REFERENCE_SECRET: SECRET,
    });
    const crash = await waitForMessage<CrashReport>(crashChild, "acknowledged");
    const snapshot = await childRequest<SnapshotWritten>(
      serverChild,
      { type: "snapshot", path: snapshotPath },
      "snapshot_written",
    );
    if (snapshot.session_count !== 1) throw new Error("crash snapshot did not contain one session");

    await killAndWait(crashChild, "SIGKILL");
    const killedClientPid = crash.process_id;
    crashChild = null;
    await killAndWait(serverChild, "SIGKILL");
    const initialServerPid = initial.ready.process_id;
    serverChild = null;

    const restarted = await startServerProcess(snapshotPath, "wp3-exit-server");
    restartedChild = restarted.child;
    if (
      restarted.ready.restore_status !== "RESTORED" ||
      restarted.ready.restored_sessions !== 1 ||
      restarted.ready.process_id === initialServerPid
    ) {
      throw new Error("reference-server process did not restore the persisted session");
    }

    const recovered = new RawAuthenticatedClient(
      restarted.ready.url,
      crash.client_id,
      "wp3-recovered",
    );
    await recovered.resume(crash.thread_id, crash.session_id);
    await recovered.sendEvent({
      scenarioId: "wp3:replay-after-restart",
      nonce: crash.nonce,
      prevHash: crash.committed_frame_hash,
    });
    const replayEvidence = await pollEvidence(restartedChild, (records) => records.some((record) =>
      record.scenario_id === "wp3:replay-after-restart" &&
      record.reason_code === "REPLAYED_NONCE"
    ));

    const postRestart = await recovered.sendEvent({
      scenarioId: "wp3:post-restart",
      prevHash: crash.committed_frame_hash,
    });
    const acceptedEvidence = await pollEvidence(restartedChild, (records) => records.some((record) =>
      record.scenario_id === "wp3:post-restart" && record.verdict === "ACCEPTED"
    ));

    const raceA = new RawAuthenticatedClient(
      restarted.ready.url,
      crash.client_id,
      "wp3-race-a",
    );
    const raceB = new RawAuthenticatedClient(
      restarted.ready.url,
      crash.client_id,
      "wp3-race-b",
    );
    await Promise.all([
      raceA.resume(crash.thread_id, crash.session_id),
      raceB.resume(crash.thread_id, crash.session_id),
    ]);
    await delay(100);
    const openOwners = [raceA, raceB].filter((client) => client.isOpen());
    if (openOwners.length !== 1) {
      throw new Error(`reconnect race left ${openOwners.length} authoritative sockets`);
    }
    await openOwners[0].sendEvent({
      scenarioId: "wp3:race-winner",
      prevHash: postRestart.hash,
    });
    const raceEvidence = await pollEvidence(restartedChild, (records) =>
      records.filter((record) => record.reason_code === "HANDSHAKE_RESUME_ACCEPTED").length >= 3 &&
      records.some((record) => record.scenario_id === "wp3:race-winner" && record.verdict === "ACCEPTED")
    );

    const snapshotFile = JSON.parse(readFileSync(snapshotPath, "utf8"));
    writeFileSync(corruptPath, `${JSON.stringify({
      ...snapshotFile,
      checksum: "00".repeat(32),
    }, null, 2)}\n`, "utf8");
    const corrupt = await startServerProcess(corruptPath, "wp3-exit-server");
    corruptChild = corrupt.child;
    if (corrupt.ready.restore_status !== "RESET" || corrupt.ready.restored_sessions !== 0) {
      throw new Error("corrupt snapshot did not fail closed into reset");
    }
    const freshAfterCorrupt = new RawAuthenticatedClient(
      corrupt.ready.url,
      crash.client_id,
      "wp3-corrupt-fresh",
    );
    await freshAfterCorrupt.freshHandshake();
    if (freshAfterCorrupt.threadId === crash.thread_id) {
      throw new Error("corrupt snapshot reused the old thread namespace");
    }

    const duplicate = await runFaultTimeline("DUPLICATE");
    const delayed = await runFaultTimeline("DELAY");
    const reordered = await runFaultTimeline("REORDER");

    const report = {
      schema_version: 1,
      profile: "org.ltp.production.wp3.crash-restart-exit.v1",
      summary: { total: 4, passed: 4, failed: 0 },
      crash_restart: {
        native_sdk: "javascript",
        client_process_id: killedClientPid,
        client_exit: "SIGKILL_AFTER_ACK_BEFORE_SENDER_COMMIT",
        initial_server_process_id: initialServerPid,
        restarted_server_process_id: restarted.ready.process_id,
        server_process_changed: restarted.ready.process_id !== initialServerPid,
        snapshot_checksum: snapshot.checksum,
        restore_status: restarted.ready.restore_status,
        replay_verdict: replayEvidence.find((record) =>
          record.scenario_id === "wp3:replay-after-restart"
        )?.reason_code,
        post_restart_verdict: acceptedEvidence.find((record) =>
          record.scenario_id === "wp3:post-restart"
        )?.verdict,
      },
      reconnect_race: {
        simultaneous_resumes: 2,
        authoritative_open_sockets: openOwners.length,
        accepted_resume_records: raceEvidence.filter((record) =>
          record.reason_code === "HANDSHAKE_RESUME_ACCEPTED"
        ).length,
        winner_accepted: raceEvidence.some((record) =>
          record.scenario_id === "wp3:race-winner" && record.verdict === "ACCEPTED"
        ),
      },
      corrupt_snapshot: {
        restore_status: corrupt.ready.restore_status,
        fresh_thread_created: freshAfterCorrupt.threadId !== crash.thread_id,
      },
      authenticated_fault_timelines: [duplicate, delayed, reordered],
    };

    const raw = JSON.stringify(report);
    for (const forbidden of [
      "raw_frame",
      "macKey",
      "encryptionKey",
      "privateKey",
      "secretKey",
      "longTermSecret",
      SECRET,
    ]) {
      if (raw.includes(forbidden)) throw new Error(`exit evidence leaked ${forbidden}`);
    }
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify(report.summary)}\n`);

    await freshAfterCorrupt.close();
    await raceA.close();
    await raceB.close();
    await recovered.close();
  } finally {
    for (const child of [crashChild, serverChild, restartedChild, corruptChild]) {
      if (child) await killAndWait(child, "SIGKILL");
    }
    rmSync(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});

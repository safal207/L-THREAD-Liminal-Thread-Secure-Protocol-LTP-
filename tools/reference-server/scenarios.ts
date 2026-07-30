import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import WebSocket from "ws";
import {
  decryptMetadata,
  deriveSessionKeys,
  deriveSharedSecret,
  encryptMetadata,
  generateEcdhKeyPair,
  generateNonce,
  generateRoutingTag,
  HandshakeAck,
  HandshakeInit,
  HandshakeReject,
  HandshakeResume,
  hashEnvelope,
  JsonValue,
  LtpEnvelope,
  REFERENCE_PROTOCOL_VERSION,
  REFERENCE_SUBPROTOCOL,
  SessionKeys,
  sha256,
  signEcdhPublicKey,
  signEnvelope,
  verifyEcdhPublicKey,
  verifyEnvelopeSignature,
} from "./protocol";
import {
  ReferenceEvidenceRecord,
  ReferenceServerHandle,
  startReferenceServer,
} from "./server";

const LONG_TERM_SECRET = "ltp-reference-long-term-secret";

export class DeterministicClock {
  constructor(private value = 1_900_000_000_000) {}

  now = (): number => this.value;

  tick(milliseconds = 1): number {
    this.value += milliseconds;
    return this.value;
  }
}

class DeterministicHex {
  private counter = 0;

  constructor(private readonly seed: string) {}

  next(bytes: number, namespace: string): string {
    this.counter += 1;
    let output = "";
    let block = 0;
    while (output.length < bytes * 2) {
      output += sha256(`${this.seed}:${namespace}:${this.counter}:${block}`);
      block += 1;
    }
    return output.slice(0, bytes * 2);
  }
}

interface BuiltFrame {
  logical: LtpEnvelope;
  wire: LtpEnvelope;
  raw: string;
}

class ReferenceScenarioClient {
  private socket: WebSocket | null = null;
  private messages: string[] = [];
  private waiters: Array<(raw: string) => void> = [];
  private keyGeneration = 0;
  private keys: SessionKeys | null = null;
  private lastSentHash: string | null = null;
  private lastReceivedHash: string | null = null;
  private seenServerNonces = new Set<string>();
  private threadId: string | null = null;
  private sessionId: string | null = null;
  private readonly random: DeterministicHex;

  constructor(
    private readonly url: string,
    private readonly seed: string,
    private readonly clock: DeterministicClock,
  ) {
    this.random = new DeterministicHex(`${seed}:client`);
  }

  get ids(): { threadId: string; sessionId: string } {
    if (!this.threadId || !this.sessionId) {
      throw new Error("client does not have an active session");
    }
    return { threadId: this.threadId, sessionId: this.sessionId };
  }

  get committedClientHash(): string | null {
    return this.lastSentHash;
  }

  get committedServerHash(): string | null {
    return this.lastReceivedHash;
  }

  async connect(): Promise<void> {
    if (this.socket) {
      await this.closeSocket();
    }
    const socket = new WebSocket(this.url, REFERENCE_SUBPROTOCOL);
    this.socket = socket;
    socket.on("message", (data) => this.enqueue(data.toString()));
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", reject);
    });
  }

  async close(): Promise<void> {
    await this.closeSocket();
  }

  async freshHandshake(version = REFERENCE_PROTOCOL_VERSION): Promise<HandshakeAck | HandshakeReject> {
    this.requireSocket();
    this.keyGeneration += 1;
    const keyPair = generateEcdhKeyPair(`${this.seed}:client-key:${this.keyGeneration}`);
    const timestamp = this.clock.tick();
    const frame: HandshakeInit = {
      type: "handshake_init",
      ltp_version: version,
      client_id: `${this.seed}-client`,
      capabilities: ["events", "ping-pong", "metadata-encryption"],
      client_public_key: keyPair.publicKey,
      client_ecdh_public_key: keyPair.publicKey,
      client_ecdh_timestamp: timestamp,
      client_ecdh_signature: signEcdhPublicKey(
        keyPair.publicKey,
        `${this.seed}-client`,
        timestamp,
        LONG_TERM_SECRET,
      ),
      key_agreement: {
        algorithm: "secp256r1",
        method: "ecdh",
        hkdf: "sha256",
      },
    };
    this.socket!.send(JSON.stringify(frame));
    const response = JSON.parse(await this.receiveRaw()) as HandshakeAck | HandshakeReject;
    if (response.type === "handshake_reject") {
      return response;
    }
    this.verifyAck(response);
    const sharedSecret = deriveSharedSecret(keyPair.privateKey, response.server_ecdh_public_key);
    this.keys = deriveSessionKeys(sharedSecret, response.session_id);
    this.threadId = response.thread_id;
    this.sessionId = response.session_id;
    this.lastSentHash = null;
    this.lastReceivedHash = null;
    this.seenServerNonces.clear();
    return response;
  }

  async resume(): Promise<HandshakeAck> {
    const previous = this.ids;
    await this.connect();
    this.keyGeneration += 1;
    const keyPair = generateEcdhKeyPair(`${this.seed}:client-key:${this.keyGeneration}`);
    const timestamp = this.clock.tick();
    const frame: HandshakeResume = {
      type: "handshake_resume",
      ltp_version: REFERENCE_PROTOCOL_VERSION,
      client_id: `${this.seed}-client`,
      thread_id: previous.threadId,
      resume_reason: "deterministic_scenario",
      client_public_key: keyPair.publicKey,
      client_ecdh_public_key: keyPair.publicKey,
      client_ecdh_timestamp: timestamp,
      client_ecdh_signature: signEcdhPublicKey(
        keyPair.publicKey,
        `${this.seed}-client`,
        timestamp,
        LONG_TERM_SECRET,
      ),
      key_agreement: {
        algorithm: "secp256r1",
        method: "ecdh",
        hkdf: "sha256",
      },
    };
    this.socket!.send(JSON.stringify(frame));
    const response = JSON.parse(await this.receiveRaw()) as HandshakeAck | HandshakeReject;
    if (response.type !== "handshake_ack") {
      throw new Error(`resume rejected: ${response.reason}`);
    }
    this.verifyAck(response);
    if (!response.resumed || response.thread_id !== previous.threadId || response.session_id !== previous.sessionId) {
      throw new Error("authenticated resume did not preserve the session namespace");
    }
    const sharedSecret = deriveSharedSecret(keyPair.privateKey, response.server_ecdh_public_key);
    this.keys = deriveSessionKeys(sharedSecret, response.session_id);
    return response;
  }

  buildFrame(
    type: string,
    payload: JsonValue,
    options: {
      commit?: boolean;
      encrypted?: boolean;
      timestamp?: number;
      nonce?: string;
      prevMessageHash?: string | null;
      signatureOverride?: string;
    } = {},
  ): BuiltFrame {
    const ids = this.ids;
    const keys = this.requireKeys();
    const timestamp = options.timestamp ?? this.clock.tick();
    const nonce = options.nonce ?? generateNonce(
      keys.macKey,
      `${this.seed}-client`,
      timestamp,
      this.random.next(16, "client-nonce"),
    );
    const logical: LtpEnvelope = {
      type,
      thread_id: ids.threadId,
      session_id: ids.sessionId,
      timestamp,
      nonce,
      payload,
      prev_message_hash: options.prevMessageHash === undefined
        ? this.lastSentHash || undefined
        : options.prevMessageHash || undefined,
      meta: { client_id: `${this.seed}-client` },
      content_encoding: "json",
    };
    logical.signature = options.signatureOverride ?? signEnvelope(logical, keys.macKey);

    let wire = logical;
    if (options.encrypted) {
      const iv = this.random.next(12, "metadata-iv");
      wire = {
        ...logical,
        thread_id: "",
        session_id: "",
        timestamp: 0,
        encrypted_metadata: encryptMetadata({
          thread_id: logical.thread_id,
          session_id: logical.session_id || "",
          timestamp: logical.timestamp,
        }, keys.encryptionKey, iv),
        routing_tag: generateRoutingTag(ids.threadId, ids.sessionId, keys.macKey),
      };
    }

    if (options.commit !== false) {
      this.lastSentHash = hashEnvelope(wire);
    }
    return { logical, wire, raw: JSON.stringify(wire) };
  }

  sendBuilt(frame: BuiltFrame): void {
    this.requireSocket().send(frame.raw);
  }

  async receiveSecure(expectedType?: string): Promise<LtpEnvelope> {
    const raw = await this.receiveRaw();
    const frame = JSON.parse(raw) as LtpEnvelope;
    const keys = this.requireKeys();
    if (expectedType && frame.type !== expectedType) {
      throw new Error(`expected ${expectedType}, received ${frame.type}`);
    }
    if (!verifyEnvelopeSignature(frame, keys.macKey)) {
      throw new Error(`server signature failed for ${frame.type}`);
    }
    const expectedPrevious = this.lastReceivedHash || "";
    const actualPrevious = frame.prev_message_hash || "";
    if (actualPrevious !== expectedPrevious) {
      throw new Error(`server hash chain mismatch for ${frame.type}`);
    }
    if (this.seenServerNonces.has(frame.nonce)) {
      throw new Error(`server replayed nonce for ${frame.type}`);
    }
    this.seenServerNonces.add(frame.nonce);
    this.lastReceivedHash = hashEnvelope(frame);
    return frame;
  }

  private verifyAck(response: HandshakeAck): void {
    if (response.ltp_version !== REFERENCE_PROTOCOL_VERSION) {
      throw new Error(`unexpected protocol version ${response.ltp_version}`);
    }
    if (!verifyEcdhPublicKey(
      response.server_ecdh_public_key,
      response.session_id,
      response.server_ecdh_timestamp,
      response.server_ecdh_signature,
      LONG_TERM_SECRET,
      this.clock.now(),
    )) {
      throw new Error("server ECDH key signature did not verify");
    }
  }

  private requireKeys(): SessionKeys {
    if (!this.keys) {
      throw new Error("session keys are not established");
    }
    return this.keys;
  }

  private requireSocket(): WebSocket {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
    return this.socket;
  }

  private enqueue(raw: string): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(raw);
    } else {
      this.messages.push(raw);
    }
  }

  private receiveRaw(timeoutMs = 5_000): Promise<string> {
    const existing = this.messages.shift();
    if (existing !== undefined) {
      return Promise.resolve(existing);
    }
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waiters.indexOf(onMessage);
        if (index >= 0) {
          this.waiters.splice(index, 1);
        }
        reject(new Error("timed out waiting for reference-server frame"));
      }, timeoutMs);
      const onMessage = (raw: string) => {
        clearTimeout(timeout);
        resolve(raw);
      };
      this.waiters.push(onMessage);
    });
  }

  private async closeSocket(): Promise<void> {
    const socket = this.socket;
    this.socket = null;
    this.messages = [];
    this.waiters = [];
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      return;
    }
    await new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
      socket.close(1000, "scenario reconnect");
      setTimeout(() => {
        if (socket.readyState !== WebSocket.CLOSED) {
          socket.terminate();
        }
        resolve();
      }, 500).unref();
    });
  }
}

export interface ScenarioResult {
  id: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export interface ReferenceScenarioReport {
  schema_version: 1;
  seed: string;
  protocol_version: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  scenarios: ScenarioResult[];
  evidence: ReferenceEvidenceRecord[];
}

function result(id: string, expected: string, actual: string): ScenarioResult {
  return { id, expected, actual, passed: expected === actual };
}

function errorCode(frame: LtpEnvelope): string {
  if (frame.type !== "error" || !frame.payload || typeof frame.payload !== "object" || Array.isArray(frame.payload)) {
    throw new Error(`expected secure error frame, received ${frame.type}`);
  }
  const code = (frame.payload as Record<string, JsonValue>).error_code;
  if (typeof code !== "string") {
    throw new Error("secure error frame has no error_code");
  }
  return code;
}

async function unsupportedVersionScenario(
  server: ReferenceServerHandle,
  seed: string,
  clock: DeterministicClock,
): Promise<ScenarioResult> {
  const socket = new WebSocket(server.url, REFERENCE_SUBPROTOCOL);
  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  const pair = generateEcdhKeyPair(`${seed}:unsupported-version`);
  const timestamp = clock.tick();
  const frame: HandshakeInit = {
    type: "handshake_init",
    ltp_version: "99.0",
    client_id: `${seed}-unsupported-client`,
    client_ecdh_public_key: pair.publicKey,
    client_ecdh_timestamp: timestamp,
    client_ecdh_signature: signEcdhPublicKey(
      pair.publicKey,
      `${seed}-unsupported-client`,
      timestamp,
      LONG_TERM_SECRET,
    ),
  };
  const response = await new Promise<HandshakeReject>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("unsupported-version response timeout")), 5_000);
    socket.once("message", (data) => {
      clearTimeout(timeout);
      resolve(JSON.parse(data.toString()) as HandshakeReject);
    });
    socket.send(JSON.stringify(frame));
  });
  socket.close();
  return result("unsupported-version", "unsupported_version", response.reason);
}

export async function runReferenceScenarios(options: {
  seed?: string;
  outputPath?: string;
} = {}): Promise<ReferenceScenarioReport> {
  const seed = options.seed ?? "wp1-seed";
  const clock = new DeterministicClock();
  const server = await startReferenceServer({
    seed,
    clock: clock.now,
    longTermSecret: LONG_TERM_SECRET,
  });
  const client = new ReferenceScenarioClient(server.url, seed, clock);
  const scenarios: ScenarioResult[] = [];

  try {
    await client.connect();
    const ack = await client.freshHandshake();
    scenarios.push(result(
      "fresh-authenticated-handshake",
      "handshake_ack",
      ack.type,
    ));

    const business = client.buildFrame("event", {
      kind: "reference_event",
      data: { scenario_id: "business-round-trip", value: 1 },
    });
    client.sendBuilt(business);
    const businessAck = await client.receiveSecure("state_update");
    scenarios.push(result("business-round-trip", "state_update", businessAck.type));

    const ping = client.buildFrame("ping", {
      kind: "control",
      scenario_id: "authenticated-ping-pong",
    });
    client.sendBuilt(ping);
    const pong = await client.receiveSecure("pong");
    scenarios.push(result("authenticated-ping-pong", "pong", pong.type));

    const encrypted = client.buildFrame("event", {
      kind: "reference_event",
      data: { scenario_id: "encrypted-metadata-round-trip", value: 2 },
    }, { encrypted: true });
    client.sendBuilt(encrypted);
    const encryptedAck = await client.receiveSecure("state_update");
    scenarios.push(result("encrypted-metadata-round-trip", "state_update", encryptedAck.type));

    const invalidSignature = client.buildFrame("event", {
      kind: "negative",
      data: { scenario_id: "invalid-signature" },
    }, { commit: false, signatureOverride: "00".repeat(32) });
    client.sendBuilt(invalidSignature);
    scenarios.push(result(
      "invalid-signature",
      "INVALID_SIGNATURE",
      errorCode(await client.receiveSecure("error")),
    ));

    const staleTimestamp = client.buildFrame("event", {
      kind: "negative",
      data: { scenario_id: "stale-timestamp" },
    }, { commit: false, timestamp: clock.now() - 120_000 });
    client.sendBuilt(staleTimestamp);
    scenarios.push(result(
      "stale-timestamp",
      "STALE_TIMESTAMP",
      errorCode(await client.receiveSecure("error")),
    ));

    const replaySeed = client.buildFrame("event", {
      kind: "reference_event",
      data: { scenario_id: "replay-seed" },
    });
    client.sendBuilt(replaySeed);
    await client.receiveSecure("state_update");

    const replayNonce = client.buildFrame("event", {
      kind: "negative",
      data: { scenario_id: "replayed-nonce" },
    }, { commit: false, nonce: replaySeed.logical.nonce });
    client.sendBuilt(replayNonce);
    scenarios.push(result(
      "replayed-nonce",
      "REPLAYED_NONCE",
      errorCode(await client.receiveSecure("error")),
    ));

    const brokenChain = client.buildFrame("event", {
      kind: "negative",
      data: { scenario_id: "broken-hash-chain" },
    }, { commit: false, prevMessageHash: "deadbeef" });
    client.sendBuilt(brokenChain);
    scenarios.push(result(
      "broken-hash-chain",
      "BROKEN_HASH_CHAIN",
      errorCode(await client.receiveSecure("error")),
    ));

    const beforeResume = {
      ids: client.ids,
      clientHash: client.committedClientHash,
      serverHash: client.committedServerHash,
    };
    const resumed = await client.resume();
    const afterResumeSnapshot = server.getSessionSnapshot(beforeResume.ids.threadId);
    const resumePreserved =
      resumed.resumed === true &&
      resumed.thread_id === beforeResume.ids.threadId &&
      resumed.session_id === beforeResume.ids.sessionId &&
      afterResumeSnapshot?.lastReceivedHash === beforeResume.clientHash &&
      afterResumeSnapshot?.lastSentHash === beforeResume.serverHash;
    scenarios.push(result(
      "same-session-resume",
      "preserved",
      resumePreserved ? "preserved" : "reset",
    ));

    const postResumeReplay = client.buildFrame("event", {
      kind: "negative",
      data: { scenario_id: "post-resume-replay" },
    }, { commit: false, nonce: replaySeed.logical.nonce });
    client.sendBuilt(postResumeReplay);
    scenarios.push(result(
      "post-resume-replay",
      "REPLAYED_NONCE",
      errorCode(await client.receiveSecure("error")),
    ));

    const postResumeEvent = client.buildFrame("event", {
      kind: "reference_event",
      data: { scenario_id: "post-resume-business", value: 3 },
    });
    client.sendBuilt(postResumeEvent);
    const postResumeAck = await client.receiveSecure("state_update");
    scenarios.push(result("post-resume-business", "state_update", postResumeAck.type));

    scenarios.push(await unsupportedVersionScenario(server, seed, clock));
  } finally {
    await client.close();
    await server.close();
  }

  const passed = scenarios.filter((scenario) => scenario.passed).length;
  const report: ReferenceScenarioReport = {
    schema_version: 1,
    seed,
    protocol_version: REFERENCE_PROTOCOL_VERSION,
    summary: {
      total: scenarios.length,
      passed,
      failed: scenarios.length - passed,
    },
    scenarios,
    evidence: server.getEvidence(),
  };

  if (options.outputPath) {
    mkdirSync(dirname(options.outputPath), { recursive: true });
    writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  return report;
}

function parseOutputPath(argv: string[]): string | undefined {
  const index = argv.indexOf("--out");
  return index >= 0 ? argv[index + 1] : undefined;
}

if (require.main === module) {
  void runReferenceScenarios({ outputPath: parseOutputPath(process.argv.slice(2)) })
    .then((report) => {
      console.log(JSON.stringify(report.summary));
      if (report.summary.failed > 0) {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import WebSocket, { RawData, WebSocketServer } from "ws";
import {
  decryptMetadata,
  deriveSessionKeys,
  deriveSharedSecret,
  frameDigest,
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

export type ReferenceVerdict = "ACCEPTED" | "REJECTED" | "SENT";

export interface ReferenceEvidenceRecord {
  sequence: number;
  observed_at_ms: number;
  direction: "inbound" | "outbound";
  frame_type: string;
  scenario_id?: string;
  verdict: ReferenceVerdict;
  reason_code: string;
  frame_digest: string;
  thread_id?: string;
  session_id?: string;
  state_digest?: string;
}

export interface ReferenceServerOptions {
  port?: number;
  host?: string;
  path?: string;
  maxPayloadBytes?: number;
  protocolVersion?: string;
  longTermSecret?: string;
  heartbeatIntervalMs?: number;
  maxMessageAgeMs?: number;
  maxFutureSkewMs?: number;
  seed?: string;
  clock?: () => number;
}

interface SessionState extends SessionKeys {
  clientId: string;
  threadId: string;
  sessionId: string;
  generation: number;
  lastReceivedHash: string | null;
  lastSentHash: string | null;
  seenNonces: Set<string>;
  routingTag: string;
  activeSocket: WebSocket;
}

export interface ReferenceServerHandle {
  readonly url: string;
  readonly protocolVersion: string;
  getEvidence(): ReferenceEvidenceRecord[];
  getSessionSnapshot(threadId: string): {
    threadId: string;
    sessionId: string;
    generation: number;
    lastReceivedHash: string | null;
    lastSentHash: string | null;
    seenNonceCount: number;
  } | null;
  writeEvidence(path: string): void;
  close(): Promise<void>;
}

const DEFAULT_SECRET = "ltp-reference-long-term-secret";
const DEFAULT_MAX_PAYLOAD_BYTES = 512 * 1024;

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function scenarioIdFromPayload(payload: JsonValue): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }
  if (typeof payload.scenario_id === "string") {
    return payload.scenario_id;
  }
  if (isRecord(payload.data) && typeof payload.data.scenario_id === "string") {
    return payload.data.scenario_id;
  }
  return undefined;
}

class ReferenceServer implements ReferenceServerHandle {
  readonly protocolVersion: string;
  private readonly wss: WebSocketServer;
  private readonly host: string;
  private readonly path: string;
  private readonly longTermSecret: string;
  private readonly heartbeatIntervalMs: number;
  private readonly maxMessageAgeMs: number;
  private readonly maxFutureSkewMs: number;
  private readonly seed: string;
  private readonly clock: () => number;
  private readonly sessions = new Map<string, SessionState>();
  private readonly socketSessions = new WeakMap<WebSocket, SessionState>();
  private readonly routes = new Map<string, SessionState>();
  private readonly evidence: ReferenceEvidenceRecord[] = [];
  private sequence = 0;
  private idCounter = 0;
  private nonceCounter = 0;
  private listeningPort = 0;

  constructor(options: ReferenceServerOptions = {}) {
    this.protocolVersion = options.protocolVersion ?? REFERENCE_PROTOCOL_VERSION;
    this.host = options.host ?? "127.0.0.1";
    this.path = options.path ?? "/ltp/reference";
    this.longTermSecret = options.longTermSecret ?? DEFAULT_SECRET;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15_000;
    this.maxMessageAgeMs = options.maxMessageAgeMs ?? 60_000;
    this.maxFutureSkewMs = options.maxFutureSkewMs ?? 5_000;
    this.seed = options.seed ?? "reference";
    this.clock = options.clock ?? Date.now;
    this.wss = new WebSocketServer({
      port: options.port ?? 0,
      host: this.host,
      path: this.path,
      maxPayload: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,
      handleProtocols: (protocols) =>
        protocols.has(REFERENCE_SUBPROTOCOL) ? REFERENCE_SUBPROTOCOL : false,
    });

    this.wss.on("connection", (socket) => {
      socket.on("message", (data) => {
        void this.handleRawFrame(socket, data);
      });
    });
  }

  async waitUntilListening(): Promise<void> {
    if (this.wss.address()) {
      this.capturePort();
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const onListening = () => {
        cleanup();
        this.capturePort();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        this.wss.off("listening", onListening);
        this.wss.off("error", onError);
      };
      this.wss.on("listening", onListening);
      this.wss.on("error", onError);
    });
  }

  get url(): string {
    if (!this.listeningPort) {
      throw new Error("reference server is not listening yet");
    }
    return `ws://${this.host}:${this.listeningPort}${this.path}`;
  }

  getEvidence(): ReferenceEvidenceRecord[] {
    return this.evidence.map((record) => ({ ...record }));
  }

  getSessionSnapshot(threadId: string) {
    const state = this.sessions.get(threadId);
    if (!state) {
      return null;
    }
    return {
      threadId: state.threadId,
      sessionId: state.sessionId,
      generation: state.generation,
      lastReceivedHash: state.lastReceivedHash,
      lastSentHash: state.lastSentHash,
      seenNonceCount: state.seenNonces.size,
    };
  }

  writeEvidence(path: string): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      `${JSON.stringify({
        schema_version: 1,
        protocol_version: this.protocolVersion,
        evidence: this.getEvidence(),
      }, null, 2)}\n`,
      "utf8",
    );
  }

  async close(): Promise<void> {
    for (const client of this.wss.clients) {
      client.close(1001, "reference server shutdown");
    }
    await new Promise<void>((resolve, reject) => {
      this.wss.close((error) => (error ? reject(error) : resolve()));
    });
  }

  private capturePort(): void {
    const address = this.wss.address();
    if (!address || typeof address === "string") {
      throw new Error("reference server did not expose a TCP port");
    }
    this.listeningPort = address.port;
  }

  private nextId(kind: "thread" | "session"): string {
    this.idCounter += 1;
    return `${kind}-${this.seed}-${String(this.idCounter).padStart(4, "0")}`;
  }

  private nextHex(bytes: number, namespace: string): string {
    this.nonceCounter += 1;
    let output = "";
    let counter = 0;
    while (output.length < bytes * 2) {
      output += sha256(`${this.seed}:${namespace}:${this.nonceCounter}:${counter}`);
      counter += 1;
    }
    return output.slice(0, bytes * 2);
  }

  private stateDigest(state: SessionState): string {
    return sha256(JSON.stringify({
      generation: state.generation,
      last_received_hash: state.lastReceivedHash,
      last_sent_hash: state.lastSentHash,
      seen_nonces: [...state.seenNonces].sort(),
      thread_id: state.threadId,
      session_id: state.sessionId,
    }));
  }

  private record(
    direction: "inbound" | "outbound",
    frameType: string,
    verdict: ReferenceVerdict,
    reasonCode: string,
    rawFrame: string,
    state?: SessionState,
    scenarioId?: string,
  ): void {
    this.sequence += 1;
    this.evidence.push({
      sequence: this.sequence,
      observed_at_ms: this.clock(),
      direction,
      frame_type: frameType,
      scenario_id: scenarioId,
      verdict,
      reason_code: reasonCode,
      frame_digest: frameDigest(rawFrame),
      thread_id: state?.threadId,
      session_id: state?.sessionId,
      state_digest: state ? this.stateDigest(state) : undefined,
    });
  }

  private sendPlain(
    socket: WebSocket,
    frame: Record<string, unknown>,
    reasonCode: string,
    state?: SessionState,
    scenarioId?: string,
  ): void {
    const raw = JSON.stringify(frame);
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(raw);
    }
    this.record("outbound", String(frame.type ?? "unknown"), "SENT", reasonCode, raw, state, scenarioId);
  }

  private sendSecure(
    socket: WebSocket,
    state: SessionState,
    type: string,
    payload: JsonValue,
    scenarioId?: string,
  ): LtpEnvelope {
    const timestamp = this.clock();
    const frame: LtpEnvelope = {
      type,
      thread_id: state.threadId,
      session_id: state.sessionId,
      timestamp,
      nonce: generateNonce(
        state.macKey,
        "reference-server",
        timestamp,
        this.nextHex(16, "server-nonce"),
      ),
      payload,
      prev_message_hash: state.lastSentHash || undefined,
      meta: { role: "reference-server" },
      content_encoding: "json",
    };
    frame.signature = signEnvelope(frame, state.macKey);
    state.lastSentHash = hashEnvelope(frame);
    const raw = JSON.stringify(frame);
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(raw);
    }
    this.record("outbound", type, "SENT", "SECURE_FRAME_SENT", raw, state, scenarioId);
    return frame;
  }

  private sendSecurityError(
    socket: WebSocket,
    state: SessionState,
    reasonCode: string,
    scenarioId?: string,
  ): void {
    this.sendSecure(socket, state, "error", {
      error_code: reasonCode,
      error_message: "Reference server rejected the frame before state commit",
      scenario_id: scenarioId || "unknown",
    }, scenarioId);
  }

  private rejectInbound(
    socket: WebSocket,
    raw: string,
    frameType: string,
    reasonCode: string,
    state?: SessionState,
    scenarioId?: string,
  ): void {
    this.record("inbound", frameType, "REJECTED", reasonCode, raw, state, scenarioId);
    if (state) {
      this.sendSecurityError(socket, state, reasonCode, scenarioId);
    }
  }

  private async handleRawFrame(socket: WebSocket, data: RawData): Promise<void> {
    const raw = data.toString();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.rejectInbound(socket, raw, "invalid_json", "INVALID_JSON");
      this.sendPlain(socket, {
        type: "handshake_reject",
        ltp_version: this.protocolVersion,
        reason: "invalid_json",
        suggest_new: true,
      }, "INVALID_JSON");
      return;
    }

    if (!isRecord(parsed) || typeof parsed.type !== "string") {
      this.rejectInbound(socket, raw, "unknown", "MALFORMED_FRAME");
      return;
    }

    if (parsed.type === "handshake_init") {
      this.handleHandshakeInit(socket, parsed as HandshakeInit, raw);
      return;
    }
    if (parsed.type === "handshake_resume") {
      this.handleHandshakeResume(socket, parsed as HandshakeResume, raw);
      return;
    }
    this.handleSecureEnvelope(socket, parsed as LtpEnvelope, raw);
  }

  private validateHandshakeCommon(
    frame: HandshakeInit | HandshakeResume,
    raw: string,
    socket: WebSocket,
  ): { publicKey: string; timestamp: number; signature: string } | null {
    if (frame.ltp_version !== this.protocolVersion) {
      this.record("inbound", frame.type, "REJECTED", "UNSUPPORTED_VERSION", raw);
      const reject: HandshakeReject = {
        type: "handshake_reject",
        ltp_version: this.protocolVersion,
        reason: "unsupported_version",
        suggest_new: false,
        supported_versions: [this.protocolVersion],
      };
      this.sendPlain(socket, reject, "UNSUPPORTED_VERSION");
      return null;
    }
    if (!frame.client_id || typeof frame.client_id !== "string") {
      this.rejectInbound(socket, raw, frame.type, "INVALID_CLIENT_ID");
      return null;
    }
    const publicKey = frame.client_ecdh_public_key || frame.client_public_key;
    const timestamp = frame.client_ecdh_timestamp;
    const signature = frame.client_ecdh_signature;
    if (!publicKey || typeof timestamp !== "number" || !signature) {
      this.rejectInbound(socket, raw, frame.type, "MISSING_AUTHENTICATED_ECDH");
      const reject: HandshakeReject = {
        type: "handshake_reject",
        ltp_version: this.protocolVersion,
        reason: "missing_authenticated_ecdh",
        suggest_new: frame.type === "handshake_resume",
      };
      this.sendPlain(socket, reject, "MISSING_AUTHENTICATED_ECDH");
      return null;
    }
    if (!verifyEcdhPublicKey(
      publicKey,
      frame.client_id,
      timestamp,
      signature,
      this.longTermSecret,
      this.clock(),
    )) {
      this.rejectInbound(socket, raw, frame.type, "ECDH_AUTH_FAILED");
      const reject: HandshakeReject = {
        type: "handshake_reject",
        ltp_version: this.protocolVersion,
        reason: "ecdh_auth_failed",
        suggest_new: false,
      };
      this.sendPlain(socket, reject, "ECDH_AUTH_FAILED");
      return null;
    }
    return { publicKey, timestamp, signature };
  }

  private buildHandshakeAck(
    state: SessionState,
    serverPublicKey: string,
    resumed: boolean,
  ): HandshakeAck {
    const timestamp = this.clock();
    return {
      type: "handshake_ack",
      ltp_version: this.protocolVersion,
      thread_id: state.threadId,
      session_id: state.sessionId,
      resumed,
      server_capabilities: [
        "canonical-envelope-v1",
        "authenticated-controls",
        "metadata-encryption",
        "resume-security-state",
      ],
      heartbeat_interval_ms: this.heartbeatIntervalMs,
      server_public_key: serverPublicKey,
      server_ecdh_public_key: serverPublicKey,
      server_ecdh_signature: signEcdhPublicKey(
        serverPublicKey,
        state.sessionId,
        timestamp,
        this.longTermSecret,
      ),
      server_ecdh_timestamp: timestamp,
      key_agreement: {
        algorithm: "secp256r1",
        method: "ecdh",
        hkdf: "sha256",
      },
      metadata: {
        server: "ltp-reference-server",
        evidence_schema: 1,
      },
    };
  }

  private handleHandshakeInit(socket: WebSocket, frame: HandshakeInit, raw: string): void {
    const validated = this.validateHandshakeCommon(frame, raw, socket);
    if (!validated) {
      return;
    }
    const threadId = this.nextId("thread");
    const sessionId = this.nextId("session");
    const serverKeys = generateEcdhKeyPair(`${this.seed}:server:${threadId}:1`);
    const sharedSecret = deriveSharedSecret(serverKeys.privateKey, validated.publicKey);
    const sessionKeys = deriveSessionKeys(sharedSecret, sessionId);
    const state: SessionState = {
      clientId: frame.client_id,
      threadId,
      sessionId,
      generation: 1,
      ...sessionKeys,
      lastReceivedHash: null,
      lastSentHash: null,
      seenNonces: new Set<string>(),
      routingTag: generateRoutingTag(threadId, sessionId, sessionKeys.macKey),
      activeSocket: socket,
    };
    this.sessions.set(threadId, state);
    this.routes.set(state.routingTag, state);
    this.socketSessions.set(socket, state);
    this.record("inbound", frame.type, "ACCEPTED", "HANDSHAKE_INIT_ACCEPTED", raw, state);
    this.sendPlain(socket, this.buildHandshakeAck(state, serverKeys.publicKey, false), "HANDSHAKE_ACK", state);
  }

  private handleHandshakeResume(socket: WebSocket, frame: HandshakeResume, raw: string): void {
    const validated = this.validateHandshakeCommon(frame, raw, socket);
    if (!validated) {
      return;
    }
    const state = this.sessions.get(frame.thread_id);
    if (!state || state.clientId !== frame.client_id) {
      this.record("inbound", frame.type, "REJECTED", "THREAD_NOT_FOUND", raw);
      const reject: HandshakeReject = {
        type: "handshake_reject",
        ltp_version: this.protocolVersion,
        reason: "thread_not_found",
        suggest_new: true,
      };
      this.sendPlain(socket, reject, "THREAD_NOT_FOUND");
      return;
    }

    const previousSocket = state.activeSocket;
    this.routes.delete(state.routingTag);
    state.generation += 1;
    const serverKeys = generateEcdhKeyPair(
      `${this.seed}:server:${state.threadId}:${state.generation}`,
    );
    const sharedSecret = deriveSharedSecret(serverKeys.privateKey, validated.publicKey);
    const sessionKeys = deriveSessionKeys(sharedSecret, state.sessionId);
    state.encryptionKey = sessionKeys.encryptionKey;
    state.macKey = sessionKeys.macKey;
    state.ivKey = sessionKeys.ivKey;
    state.routingTag = generateRoutingTag(state.threadId, state.sessionId, state.macKey);
    state.activeSocket = socket;
    this.routes.set(state.routingTag, state);
    this.socketSessions.set(socket, state);

    this.record("inbound", frame.type, "ACCEPTED", "HANDSHAKE_RESUME_ACCEPTED", raw, state);
    this.sendPlain(socket, this.buildHandshakeAck(state, serverKeys.publicKey, true), "HANDSHAKE_ACK", state);
    if (previousSocket !== socket && previousSocket.readyState === WebSocket.OPEN) {
      previousSocket.close(4001, "replaced by authenticated resume");
    }
  }

  private resolveLogicalEnvelope(
    socket: WebSocket,
    wireFrame: LtpEnvelope,
  ): { state: SessionState; logical: LtpEnvelope } | null {
    const socketState = this.socketSessions.get(socket);
    const routedState = wireFrame.routing_tag ? this.routes.get(wireFrame.routing_tag) : undefined;
    const state = socketState || routedState;
    if (!state) {
      return null;
    }
    if (!wireFrame.encrypted_metadata) {
      return { state, logical: wireFrame };
    }
    if (wireFrame.routing_tag !== state.routingTag) {
      throw new Error("ROUTING_TAG_MISMATCH");
    }
    const metadata = decryptMetadata(wireFrame.encrypted_metadata, state.encryptionKey);
    return {
      state,
      logical: {
        ...wireFrame,
        thread_id: metadata.thread_id,
        session_id: metadata.session_id,
        timestamp: metadata.timestamp,
      },
    };
  }

  private handleSecureEnvelope(socket: WebSocket, wireFrame: LtpEnvelope, raw: string): void {
    let resolved: { state: SessionState; logical: LtpEnvelope } | null;
    try {
      resolved = this.resolveLogicalEnvelope(socket, wireFrame);
    } catch (error) {
      const state = this.socketSessions.get(socket);
      this.rejectInbound(
        socket,
        raw,
        wireFrame.type || "unknown",
        error instanceof Error ? error.message : "METADATA_DECRYPT_FAILED",
        state,
        scenarioIdFromPayload(wireFrame.payload),
      );
      return;
    }
    if (!resolved) {
      this.rejectInbound(socket, raw, wireFrame.type || "unknown", "UNKNOWN_SESSION");
      return;
    }
    const { state, logical } = resolved;
    const scenarioId = scenarioIdFromPayload(logical.payload);

    if (
      typeof logical.type !== "string" ||
      typeof logical.thread_id !== "string" ||
      typeof logical.timestamp !== "number" ||
      typeof logical.nonce !== "string" ||
      logical.payload === undefined
    ) {
      this.rejectInbound(socket, raw, logical.type || "unknown", "MALFORMED_ENVELOPE", state, scenarioId);
      return;
    }
    if (logical.thread_id !== state.threadId || logical.session_id !== state.sessionId) {
      this.rejectInbound(socket, raw, logical.type, "SESSION_MISMATCH", state, scenarioId);
      return;
    }

    const age = this.clock() - logical.timestamp;
    if (age > this.maxMessageAgeMs) {
      this.rejectInbound(socket, raw, logical.type, "STALE_TIMESTAMP", state, scenarioId);
      return;
    }
    if (age < -this.maxFutureSkewMs) {
      this.rejectInbound(socket, raw, logical.type, "FUTURE_TIMESTAMP", state, scenarioId);
      return;
    }
    if (!verifyEnvelopeSignature(logical, state.macKey)) {
      this.rejectInbound(socket, raw, logical.type, "INVALID_SIGNATURE", state, scenarioId);
      return;
    }

    const expectedPreviousHash = state.lastReceivedHash || "";
    const actualPreviousHash = logical.prev_message_hash || "";
    if (actualPreviousHash !== expectedPreviousHash) {
      this.rejectInbound(socket, raw, logical.type, "BROKEN_HASH_CHAIN", state, scenarioId);
      return;
    }
    if (state.seenNonces.has(logical.nonce)) {
      this.rejectInbound(socket, raw, logical.type, "REPLAYED_NONCE", state, scenarioId);
      return;
    }

    const candidateHash = hashEnvelope(logical);
    state.lastReceivedHash = candidateHash;
    state.seenNonces.add(logical.nonce);
    this.record("inbound", logical.type, "ACCEPTED", "SECURITY_PIPELINE_ACCEPTED", raw, state, scenarioId);

    if (logical.type === "ping") {
      this.sendSecure(socket, state, "pong", {
        kind: "control",
        scenario_id: scenarioId || "authenticated-ping-pong",
      }, scenarioId);
      return;
    }

    this.sendSecure(socket, state, "state_update", {
      kind: "reference_ack",
      data: {
        accepted_type: logical.type,
        scenario_id: scenarioId || "business-round-trip",
      },
    }, scenarioId);
  }
}

export async function startReferenceServer(
  options: ReferenceServerOptions = {},
): Promise<ReferenceServerHandle> {
  const server = new ReferenceServer(options);
  await server.waitUntilListening();
  return server;
}

if (require.main === module) {
  void startReferenceServer({ port: Number(process.env.PORT || 4003) })
    .then((server) => {
      console.log(`LTP reference server listening at ${server.url}`);
      const shutdown = () => {
        void server.close().finally(() => process.exit(0));
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

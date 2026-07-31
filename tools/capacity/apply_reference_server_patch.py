#!/usr/bin/env python3
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


server_path = Path("tools/reference-server/server.ts")
server = server_path.read_text(encoding="utf-8")

server = replace_once(
    server,
    'import WebSocket, { RawData, WebSocketServer } from "ws";\n',
    'import WebSocket, { RawData, WebSocketServer } from "ws";\nimport { CapacityController, CapacityLimits, CapacitySnapshot } from "../capacity/limits";\n',
    "capacity import",
)
server = replace_once(
    server,
    '  clock?: () => number;\n}',
    '  clock?: () => number;\n  capacityLimits?: Partial<CapacityLimits>;\n}',
    "server options",
)
server = replace_once(
    server,
    '  seenNonces: Set<string>;\n  routingTag: string;\n  activeSocket: WebSocket;\n}',
    '  seenNonces: Set<string>;\n  nonceTimeline: Array<{ nonce: string; timestamp: number }>;\n  routingTag: string;\n  activeSocket: WebSocket;\n  lastActivityMs: number;\n  disconnectedAtMs: number | null;\n}',
    "session capacity state",
)
server = replace_once(
    server,
    '  getEvidence(): ReferenceEvidenceRecord[];\n',
    '  getEvidence(): ReferenceEvidenceRecord[];\n  getCapacitySnapshot(): CapacitySnapshot;\n',
    "handle snapshot contract",
)
server = replace_once(
    server,
    '  private readonly clock: () => number;\n  private readonly sessions',
    '  private readonly clock: () => number;\n  private readonly capacity: CapacityController;\n  private readonly sessions',
    "controller field",
)
server = replace_once(
    server,
    '    this.clock = options.clock ?? Date.now;\n    this.wss = new WebSocketServer({',
    '    this.clock = options.clock ?? Date.now;\n    const capacityOverrides: Partial<CapacityLimits> = { ...options.capacityLimits };\n    if (options.maxPayloadBytes !== undefined) {\n      capacityOverrides.maxFrameBytes = options.maxPayloadBytes;\n    }\n    this.capacity = new CapacityController(capacityOverrides, this.clock, this.maxMessageAgeMs);\n    this.wss = new WebSocketServer({',
    "controller initialization",
)
server = replace_once(
    server,
    '      maxPayload: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,',
    '      maxPayload: this.capacity.limits.maxFrameBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,',
    "websocket max payload",
)
server = replace_once(
    server,
    '''    this.wss.on("connection", (socket) => {
      socket.on("message", (data) => {
        void this.handleRawFrame(socket, data);
      });
    });''',
    '''    this.wss.on("connection", (socket) => {
      socket.on("message", (data) => {
        void this.handleRawFrame(socket, data);
      });
      socket.on("close", () => {
        const state = this.socketSessions.get(socket);
        if (state && state.activeSocket === socket) {
          state.disconnectedAtMs = this.clock();
          state.lastActivityMs = this.clock();
        }
      });
      socket.on("error", (error: Error) => {
        if (/max payload size exceeded/i.test(error.message)) {
          this.record("inbound", "unknown", "REJECTED", "FRAME_TOO_LARGE", error.message);
        }
      });
    });''',
    "socket capacity hooks",
)
server = replace_once(
    server,
    '''  getEvidence(): ReferenceEvidenceRecord[] {
    return this.evidence.map((record) => ({ ...record }));
  }

  getSessionSnapshot''',
    '''  getEvidence(): ReferenceEvidenceRecord[] {
    return this.evidence.map((record) => ({ ...record }));
  }

  getCapacitySnapshot(): CapacitySnapshot {
    let nonceEntries = 0;
    for (const state of this.sessions.values()) {
      this.capacity.pruneNonceCache(state.nonceTimeline, state.seenNonces);
      nonceEntries += state.seenNonces.size;
    }
    return this.capacity.snapshot({
      activeSessions: this.sessions.size,
      routeEntries: this.routes.size,
      nonceEntries,
      evidenceRecords: this.evidence.length,
    });
  }

  getSessionSnapshot''',
    "capacity snapshot",
)
server = replace_once(
    server,
    '''    this.evidence.push({
      sequence: this.sequence,
      observed_at_ms: this.clock(),
      direction,
      frame_type: frameType,
      scenario_id: scenarioId,
      verdict,
      reason_code: reasonCode,
      frame_digest: frameDigest(rawFrame),
      client_id: state?.clientId,
      thread_id: state?.threadId,
      session_id: state?.sessionId,
      state_digest: state ? this.stateDigest(state) : undefined,
    });''',
    '''    this.capacity.recordBounded(this.evidence, {
      sequence: this.sequence,
      observed_at_ms: this.clock(),
      direction,
      frame_type: frameType,
      scenario_id: scenarioId,
      verdict,
      reason_code: reasonCode,
      frame_digest: frameDigest(rawFrame),
      client_id: state?.clientId,
      thread_id: state?.threadId,
      session_id: state?.sessionId,
      state_digest: state ? this.stateDigest(state) : undefined,
    });''',
    "bounded evidence",
)
server = replace_once(
    server,
    '''    const raw = JSON.stringify(frame);
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(raw);
    }
    this.record("outbound", String(frame.type ?? "unknown"), "SENT", reasonCode, raw, state, scenarioId);''',
    '''    const raw = JSON.stringify(frame);
    const pendingReason = this.capacity.pendingSendReason(
      socket.bufferedAmount,
      Buffer.byteLength(raw, "utf8"),
    );
    if (pendingReason) {
      this.record("outbound", String(frame.type ?? "unknown"), "REJECTED", pendingReason, raw, state, scenarioId);
      socket.close(1013, pendingReason);
      return;
    }
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(raw);
    }
    this.record("outbound", String(frame.type ?? "unknown"), "SENT", reasonCode, raw, state, scenarioId);''',
    "plain backpressure",
)
server = replace_once(
    server,
    '''    frame.signature = signEnvelope(frame, state.macKey);
    state.lastSentHash = hashEnvelope(frame);
    const raw = JSON.stringify(frame);
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(raw);
    }
    this.record("outbound", type, "SENT", "SECURE_FRAME_SENT", raw, state, scenarioId);
    return frame;''',
    '''    frame.signature = signEnvelope(frame, state.macKey);
    const raw = JSON.stringify(frame);
    const pendingReason = this.capacity.pendingSendReason(
      socket.bufferedAmount,
      Buffer.byteLength(raw, "utf8"),
    );
    if (pendingReason) {
      this.record("outbound", type, "REJECTED", pendingReason, raw, state, scenarioId);
      socket.close(1013, pendingReason);
      return frame;
    }
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(raw);
    }
    state.lastSentHash = hashEnvelope(frame);
    state.lastActivityMs = this.clock();
    this.record("outbound", type, "SENT", "SECURE_FRAME_SENT", raw, state, scenarioId);
    return frame;''',
    "secure backpressure",
)
server = replace_once(
    server,
    '''  private async handleRawFrame(socket: WebSocket, data: RawData): Promise<void> {
    const raw = data.toString();
    let parsed: unknown;''',
    '''  private async handleRawFrame(socket: WebSocket, data: RawData): Promise<void> {
    const raw = data.toString();
    this.cleanupExpiredSessions();
    const frameReason = this.capacity.frameReason(Buffer.byteLength(raw, "utf8"));
    if (frameReason) {
      this.rejectInbound(socket, raw, "unknown", frameReason, this.socketSessions.get(socket));
      socket.close(1009, frameReason);
      return;
    }
    let parsed: unknown;''',
    "inbound frame boundary",
)
server = replace_once(
    server,
    '''    const threadId = this.nextId("thread");
    const sessionId = this.nextId("session");''',
    '''    const sessionReason = this.capacity.newSessionReason(this.sessions.size);
    if (sessionReason) {
      this.record("inbound", frame.type, "REJECTED", sessionReason, raw);
      const reject: HandshakeReject = {
        type: "handshake_reject",
        ltp_version: this.protocolVersion,
        reason: "session_capacity_limit",
        suggest_new: false,
      };
      this.sendPlain(socket, reject, sessionReason);
      return;
    }
    const threadId = this.nextId("thread");
    const sessionId = this.nextId("session");''',
    "session capacity handshake",
)
server = replace_once(
    server,
    '''      seenNonces: new Set<string>(),
      routingTag: generateRoutingTag(threadId, sessionId, sessionKeys.macKey),
      activeSocket: socket,
    };''',
    '''      seenNonces: new Set<string>(),
      nonceTimeline: [],
      routingTag: generateRoutingTag(threadId, sessionId, sessionKeys.macKey),
      activeSocket: socket,
      lastActivityMs: this.clock(),
      disconnectedAtMs: null,
    };''',
    "new session capacity fields",
)
server = replace_once(
    server,
    '''    const state = this.sessions.get(frame.thread_id);
    if (!state || state.clientId !== frame.client_id) {''',
    '''    const reconnectReason = this.capacity.reconnectReason(frame.client_id);
    if (reconnectReason) {
      this.record("inbound", frame.type, "REJECTED", reconnectReason, raw);
      const reject: HandshakeReject = {
        type: "handshake_reject",
        ltp_version: this.protocolVersion,
        reason: "reconnect_rate_limit",
        suggest_new: false,
      };
      this.sendPlain(socket, reject, reconnectReason);
      return;
    }
    const state = this.sessions.get(frame.thread_id);
    if (!state || state.clientId !== frame.client_id) {''',
    "resume rate limit",
)
server = replace_once(
    server,
    '''    state.routingTag = generateRoutingTag(state.threadId, state.sessionId, state.macKey);
    state.activeSocket = socket;
    this.routes.set(state.routingTag, state);''',
    '''    state.routingTag = generateRoutingTag(state.threadId, state.sessionId, state.macKey);
    state.activeSocket = socket;
    state.lastActivityMs = this.clock();
    state.disconnectedAtMs = null;
    this.routes.set(state.routingTag, state);''',
    "resume activity",
)
server = replace_once(
    server,
    '''    if (state.seenNonces.has(logical.nonce)) {
      this.rejectInbound(socket, raw, logical.type, "REPLAYED_NONCE", state, scenarioId);
      return;
    }

    // The chain commits the exact transmitted envelope. Signature checks use
    // the decrypted logical view, but reconnect continuity must follow wire bytes.
    const candidateHash = hashEnvelope(wireFrame);
    state.lastReceivedHash = candidateHash;
    state.seenNonces.add(logical.nonce);
    this.record("inbound", logical.type, "ACCEPTED", "SECURITY_PIPELINE_ACCEPTED", raw, state, scenarioId);''',
    '''    const nonceReason = this.capacity.trackNonceReason(
      logical.nonce,
      logical.timestamp,
      state.nonceTimeline,
      state.seenNonces,
    );
    if (nonceReason) {
      this.rejectInbound(socket, raw, logical.type, nonceReason, state, scenarioId);
      return;
    }

    // The chain commits the exact transmitted envelope. Signature checks use
    // the decrypted logical view, but reconnect continuity must follow wire bytes.
    const candidateHash = hashEnvelope(wireFrame);
    state.lastReceivedHash = candidateHash;
    state.lastActivityMs = this.clock();
    this.record("inbound", logical.type, "ACCEPTED", "SECURITY_PIPELINE_ACCEPTED", raw, state, scenarioId);''',
    "bounded nonce cache",
)
server = replace_once(
    server,
    '''    this.sendSecure(socket, state, "state_update", {
      kind: "reference_ack",
      data: {
        accepted_type: logical.type,
        scenario_id: scenarioId || "business-round-trip",
      },
    }, scenarioId);
  }
}''',
    '''    this.sendSecure(socket, state, "state_update", {
      kind: "reference_ack",
      data: {
        accepted_type: logical.type,
        scenario_id: scenarioId || "business-round-trip",
      },
    }, scenarioId);
  }

  private cleanupExpiredSessions(): void {
    const now = this.clock();
    for (const [threadId, state] of this.sessions.entries()) {
      const disconnected = state.disconnectedAtMs;
      if (
        disconnected !== null &&
        now - disconnected > this.capacity.limits.maxSessionIdleMs &&
        state.activeSocket.readyState !== WebSocket.OPEN
      ) {
        this.sessions.delete(threadId);
        this.routes.delete(state.routingTag);
      }
    }
  }
}''',
    "idle session cleanup",
)
server_path.write_text(server, encoding="utf-8")

scenarios_path = Path("tools/reference-server/scenarios.ts")
scenarios = scenarios_path.read_text(encoding="utf-8")
scenarios = replace_once(
    scenarios,
    "class ReferenceScenarioClient {",
    "export class ReferenceScenarioClient {",
    "scenario client export",
)
scenarios_path.write_text(scenarios, encoding="utf-8")
print("WP4 exact reference-server patch applied")

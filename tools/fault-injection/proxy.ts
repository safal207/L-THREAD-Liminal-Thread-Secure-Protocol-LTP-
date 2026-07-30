import { createHash } from "node:crypto";
import WebSocket, { RawData, WebSocketServer } from "ws";
import { REFERENCE_SUBPROTOCOL } from "../reference-server/protocol";
import { buildFaultSchedule, FaultKind } from "./harness";

export interface ProxyEvidenceRecord {
  sequence: number;
  client_key: string;
  owner_generation: number;
  direction: "downstream_to_upstream" | "upstream_to_downstream" | "proxy";
  fault: FaultKind | "PASS_THROUGH";
  verdict: "FORWARDED" | "DROPPED" | "REJECTED" | "BUFFERED";
  reason_code: string;
  frame_digest: string;
}

export interface FaultProxyOptions {
  upstreamUrl: string;
  seed?: string;
  faultSequence?: FaultKind[];
  host?: string;
  port?: number;
  path?: string;
}

export interface FaultProxyHandle {
  readonly url: string;
  urlFor(clientKey: string): string;
  getEvidence(): ProxyEvidenceRecord[];
  flush(clientKey?: string): void;
  close(): Promise<void>;
}

interface BufferedFrame {
  payload: Buffer;
  isBinary: boolean;
}

interface ConnectionState {
  clientKey: string;
  generation: number;
  downstream: WebSocket;
  upstream: WebSocket;
  faultIndex: number;
  delayed: BufferedFrame[];
  reorder: BufferedFrame | null;
}

function digest(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function asBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

class DeterministicFaultProxy implements FaultProxyHandle {
  private readonly host: string;
  private readonly path: string;
  private readonly faults: FaultKind[];
  private readonly wss: WebSocketServer;
  private readonly activeGeneration = new Map<string, number>();
  private readonly connections = new Set<ConnectionState>();
  private readonly evidence: ProxyEvidenceRecord[] = [];
  private listeningPort = 0;
  private sequence = 0;

  constructor(private readonly options: FaultProxyOptions) {
    this.host = options.host ?? "127.0.0.1";
    this.path = options.path ?? "/ltp/fault";
    this.faults = options.faultSequence ??
      buildFaultSchedule(options.seed ?? "wp3-proxy-seed").map((step) => step.kind);
    this.wss = new WebSocketServer({
      host: this.host,
      port: options.port ?? 0,
      path: this.path,
      handleProtocols: (protocols) =>
        protocols.has(REFERENCE_SUBPROTOCOL) ? REFERENCE_SUBPROTOCOL : false,
    });
    this.wss.on("connection", (downstream, request) => {
      const parsed = new URL(request.url ?? this.path, `ws://${this.host}`);
      const clientKey = parsed.searchParams.get("client") ?? "anonymous";
      const generation = (this.activeGeneration.get(clientKey) ?? 0) + 1;
      this.activeGeneration.set(clientKey, generation);
      const upstream = new WebSocket(this.options.upstreamUrl, REFERENCE_SUBPROTOCOL);
      const state: ConnectionState = {
        clientKey,
        generation,
        downstream,
        upstream,
        faultIndex: 0,
        delayed: [],
        reorder: null,
      };
      this.connections.add(state);
      this.record(state, "proxy", "PASS_THROUGH", "FORWARDED", "OWNER_REGISTERED", Buffer.alloc(0));

      downstream.on("message", (data, isBinary) => {
        void this.handleDownstream(state, asBuffer(data), isBinary);
      });
      upstream.on("message", (data, isBinary) => {
        const payload = asBuffer(data);
        if (downstream.readyState === WebSocket.OPEN) {
          downstream.send(payload, { binary: isBinary });
        }
        this.record(
          state,
          "upstream_to_downstream",
          "PASS_THROUGH",
          "FORWARDED",
          "UPSTREAM_FRAME_FORWARDED",
          payload,
        );
      });
      const closePeer = (peer: WebSocket) => {
        if (peer.readyState === WebSocket.OPEN) {
          peer.close(1001, "fault proxy peer closed");
        } else if (peer.readyState === WebSocket.CONNECTING) {
          peer.terminate();
        }
      };
      downstream.on("close", () => {
        closePeer(upstream);
        this.connections.delete(state);
      });
      upstream.on("close", () => closePeer(downstream));
    });
  }

  async waitUntilListening(): Promise<void> {
    if (this.wss.address()) {
      this.capturePort();
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.wss.once("listening", () => {
        this.capturePort();
        resolve();
      });
      this.wss.once("error", reject);
    });
  }

  get url(): string {
    if (!this.listeningPort) throw new Error("fault proxy is not listening");
    return `ws://${this.host}:${this.listeningPort}${this.path}`;
  }

  urlFor(clientKey: string): string {
    return `${this.url}?client=${encodeURIComponent(clientKey)}`;
  }

  getEvidence(): ProxyEvidenceRecord[] {
    return this.evidence.map((record) => ({ ...record }));
  }

  flush(clientKey?: string): void {
    for (const state of this.connections) {
      if (clientKey && state.clientKey !== clientKey) continue;
      this.flushState(state);
    }
  }

  async close(): Promise<void> {
    for (const state of this.connections) {
      if (state.downstream.readyState !== WebSocket.CLOSED) state.downstream.terminate();
      if (state.upstream.readyState !== WebSocket.CLOSED) state.upstream.terminate();
    }
    this.connections.clear();
    await new Promise<void>((resolve, reject) => {
      this.wss.close((error) => (error ? reject(error) : resolve()));
    });
  }

  private async handleDownstream(
    state: ConnectionState,
    payload: Buffer,
    isBinary: boolean,
  ): Promise<void> {
    if (this.activeGeneration.get(state.clientKey) !== state.generation) {
      this.record(
        state,
        "proxy",
        "STALE_OWNER",
        "REJECTED",
        "STALE_TRANSPORT_OWNER",
        payload,
      );
      if (state.downstream.readyState === WebSocket.OPEN) {
        state.downstream.send(JSON.stringify({
          type: "proxy_reject",
          reason: "STALE_TRANSPORT_OWNER",
          owner_generation: state.generation,
        }));
      }
      return;
    }

    await this.waitForOpen(state.upstream);
    const fault = this.nextFault(state);
    const frame: BufferedFrame = { payload, isBinary };
    switch (fault) {
      case "DROP_BEFORE_COMMIT":
        this.record(state, "downstream_to_upstream", fault, "DROPPED", fault, payload);
        return;
      case "DROP_AFTER_COMMIT":
        state.upstream.send(payload, { binary: isBinary });
        this.record(state, "downstream_to_upstream", fault, "FORWARDED", fault, payload);
        if (state.downstream.readyState === WebSocket.OPEN) {
          state.downstream.close(4102, "deterministic drop after forward");
        }
        return;
      case "DELAY":
        state.delayed.push(frame);
        this.record(state, "downstream_to_upstream", fault, "BUFFERED", fault, payload);
        return;
      case "DUPLICATE":
        state.upstream.send(payload, { binary: isBinary });
        state.upstream.send(payload, { binary: isBinary });
        this.record(state, "downstream_to_upstream", fault, "FORWARDED", fault, payload);
        return;
      case "REORDER":
        if (!state.reorder) {
          state.reorder = frame;
          this.record(state, "downstream_to_upstream", fault, "BUFFERED", "REORDER_BUFFERED", payload);
        } else {
          state.upstream.send(payload, { binary: isBinary });
          state.upstream.send(state.reorder.payload, { binary: state.reorder.isBinary });
          this.record(state, "downstream_to_upstream", fault, "FORWARDED", "REORDER_RELEASED", payload);
          state.reorder = null;
        }
        return;
      case "FRAGMENT": {
        const split = Math.max(1, Math.floor(payload.length / 2));
        state.upstream.send(payload.subarray(0, split), { binary: isBinary, fin: false });
        state.upstream.send(payload.subarray(split), { binary: isBinary, fin: true });
        this.record(state, "downstream_to_upstream", fault, "FORWARDED", fault, payload);
        return;
      }
      case "STALE_OWNER":
      case "SIMULTANEOUS_RECONNECT":
      case "CRASH_BEFORE_PERSIST":
      case "SERVER_RESTART":
      case "CORRUPT_SNAPSHOT":
      case "REPLAY":
        state.upstream.send(payload, { binary: isBinary });
        this.record(
          state,
          "downstream_to_upstream",
          fault,
          "FORWARDED",
          "MODELLED_BY_LIFECYCLE_HARNESS",
          payload,
        );
        return;
      default:
        state.upstream.send(payload, { binary: isBinary });
        this.record(
          state,
          "downstream_to_upstream",
          "PASS_THROUGH",
          "FORWARDED",
          "FRAME_FORWARDED",
          payload,
        );
    }
  }

  private flushState(state: ConnectionState): void {
    if (state.upstream.readyState !== WebSocket.OPEN) return;
    for (const frame of state.delayed.splice(0)) {
      state.upstream.send(frame.payload, { binary: frame.isBinary });
      this.record(
        state,
        "downstream_to_upstream",
        "DELAY",
        "FORWARDED",
        "DELAY_RELEASED",
        frame.payload,
      );
    }
    if (state.reorder) {
      const frame = state.reorder;
      state.reorder = null;
      state.upstream.send(frame.payload, { binary: frame.isBinary });
      this.record(
        state,
        "downstream_to_upstream",
        "REORDER",
        "FORWARDED",
        "REORDER_FLUSHED",
        frame.payload,
      );
    }
  }

  private nextFault(state: ConnectionState): FaultKind | "PASS_THROUGH" {
    if (this.faults.length === 0) return "PASS_THROUGH";
    const fault = this.faults[state.faultIndex % this.faults.length];
    state.faultIndex += 1;
    return fault;
  }

  private waitForOpen(socket: WebSocket): Promise<void> {
    if (socket.readyState === WebSocket.OPEN) return Promise.resolve();
    if (socket.readyState !== WebSocket.CONNECTING) {
      return Promise.reject(new Error("upstream socket is not available"));
    }
    return new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", reject);
    });
  }

  private record(
    state: ConnectionState,
    direction: ProxyEvidenceRecord["direction"],
    fault: ProxyEvidenceRecord["fault"],
    verdict: ProxyEvidenceRecord["verdict"],
    reasonCode: string,
    payload: Buffer,
  ): void {
    this.sequence += 1;
    this.evidence.push({
      sequence: this.sequence,
      client_key: state.clientKey,
      owner_generation: state.generation,
      direction,
      fault,
      verdict,
      reason_code: reasonCode,
      frame_digest: digest(payload),
    });
  }

  private capturePort(): void {
    const address = this.wss.address();
    if (!address || typeof address === "string") {
      throw new Error("fault proxy did not expose a TCP port");
    }
    this.listeningPort = address.port;
  }
}

export async function startFaultProxy(options: FaultProxyOptions): Promise<FaultProxyHandle> {
  const proxy = new DeterministicFaultProxy(options);
  await proxy.waitUntilListening();
  return proxy;
}

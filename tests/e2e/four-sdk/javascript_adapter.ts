import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import WebSocket from "ws";

(globalThis as any).WebSocket = WebSocket;
const {
  generateNonce,
  hashEnvelope,
  LtpClient,
  signMessage,
} = require("../../../sdk/js/dist") as Record<string, any>;
type LtpEnvelope = any;

const url = process.env.LTP_REFERENCE_URL;
const outputPath = process.env.LTP_ADAPTER_OUTPUT;
const secretKey = process.env.LTP_REFERENCE_SECRET || "ltp-reference-long-term-secret";
const sdk = "javascript";
const clientId = `wp2-${sdk}`;

if (!url || !outputPath) {
  throw new Error("LTP_REFERENCE_URL and LTP_ADAPTER_OUTPUT are required");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function withTimeout<T>(promise: Promise<T>, label: string, ms = 8_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error(`timeout waiting for ${label}`)), ms),
    ),
  ]);
}

async function main(): Promise<void> {
  const connectedQueue: Array<{ threadId: string; sessionId: string }> = [];
  const connectedWaiters: Array<(value: { threadId: string; sessionId: string }) => void> = [];
  const updateQueue: unknown[] = [];
  const updateWaiters: Array<(value: unknown) => void> = [];
  const pongWaiters: Array<() => void> = [];
  const errorQueue: string[] = [];
  const errorWaiters: Array<(value: string) => void> = [];

  const nextConnected = () => {
    const value = connectedQueue.shift();
    if (value) return Promise.resolve(value);
    const wait = deferred<{ threadId: string; sessionId: string }>();
    connectedWaiters.push(wait.resolve);
    return wait.promise;
  };
  const nextUpdate = () => {
    const value = updateQueue.shift();
    if (value !== undefined) return Promise.resolve(value);
    const wait = deferred<unknown>();
    updateWaiters.push(wait.resolve);
    return wait.promise;
  };
  const nextPong = () => {
    const wait = deferred<void>();
    pongWaiters.push(() => wait.resolve());
    return wait.promise;
  };
  const nextError = () => {
    const value = errorQueue.shift();
    if (value) return Promise.resolve(value);
    const wait = deferred<string>();
    errorWaiters.push(wait.resolve);
    return wait.promise;
  };

  const client = new LtpClient(
    url,
    {
      clientId,
      secretKey,
      enableEcdhKeyExchange: true,
      enableMetadataEncryption: false,
      requireSignatureVerification: true,
      heartbeat: { enabled: false, intervalMs: 60_000, timeoutMs: 60_000 },
      reconnect: { maxRetries: 0, baseDelayMs: 50, maxDelayMs: 50 },
    },
    {
      onConnected: (threadId: string, sessionId: string) => {
        const value = { threadId, sessionId };
        const waiter = connectedWaiters.shift();
        if (waiter) waiter(value); else connectedQueue.push(value);
      },
      onStateUpdate: (payload: unknown) => {
        const waiter = updateWaiters.shift();
        if (waiter) waiter(payload); else updateQueue.push(payload);
      },
      onPong: () => {
        pongWaiters.shift()?.();
      },
      onError: (error: any) => {
        const code = error.error_code || "UNKNOWN_ERROR";
        const waiter = errorWaiters.shift();
        if (waiter) waiter(code); else errorQueue.push(code);
      },
    },
  );

  const actions: string[] = [];
  await client.connect();
  const fresh = await withTimeout(nextConnected(), "fresh handshake");
  actions.push("fresh-handshake");

  client.sendEvent("wp2", { scenario_id: `${sdk}:business`, value: 1 });
  await withTimeout(nextUpdate(), "business acknowledgement");
  actions.push("business");

  const pongPromise = nextPong();
  client.sendPing();
  await withTimeout(pongPromise, "authenticated pong");
  actions.push("ping-pong");

  const state = client as any;
  state.options.enableMetadataEncryption = true;
  client.sendEvent("wp2", { scenario_id: `${sdk}:encrypted`, value: 2 });
  await withTimeout(nextUpdate(), "encrypted acknowledgement");
  actions.push("encrypted");
  state.options.enableMetadataEncryption = false;

  const buildRaw = async (
    scenarioId: string,
    options: {
      timestamp?: number;
      nonce?: string;
      prev?: string;
      invalidSignature?: boolean;
      commit?: boolean;
    } = {},
  ): Promise<LtpEnvelope> => {
    const timestamp = options.timestamp ?? Date.now();
    const nonce = options.nonce ?? await generateNonce(
      state.options.sessionMacKey,
      clientId,
      timestamp,
      `${scenarioId.padEnd(32, "0").slice(0, 32)}`,
    );
    const envelope: LtpEnvelope = {
      type: "event",
      thread_id: state.threadId,
      session_id: state.sessionId,
      timestamp,
      nonce,
      payload: { event_type: "wp2", data: { scenario_id: scenarioId } },
      prev_message_hash: options.prev === undefined ? state.lastSentHash || undefined : options.prev,
      meta: { client_id: clientId },
      content_encoding: "json",
    };
    envelope.signature = options.invalidSignature
      ? "00".repeat(32)
      : await signMessage(envelope as any, state.options.sessionMacKey);
    if (options.commit) {
      state.lastSentHash = await hashEnvelope(envelope as any);
      state.persistSecurityState();
    }
    return envelope;
  };

  const invalid = await buildRaw(`${sdk}:invalid-signature`, { invalidSignature: true });
  state.sendRaw(invalid);
  await withTimeout(nextError(), "invalid-signature error");
  actions.push("invalid-signature");

  const stale = await buildRaw(`${sdk}:stale-timestamp`, { timestamp: Date.now() - 120_000 });
  state.sendRaw(stale);
  await withTimeout(nextError(), "stale-timestamp error");
  actions.push("stale-timestamp");

  const replaySeed = await buildRaw(`${sdk}:replay-seed`, { commit: true });
  state.sendRaw(replaySeed);
  await withTimeout(nextUpdate(), "replay seed acknowledgement");

  const replay = await buildRaw(`${sdk}:replayed-nonce`, { nonce: replaySeed.nonce });
  state.sendRaw(replay);
  await withTimeout(nextError(), "replay error");
  actions.push("replayed-nonce");

  const broken = await buildRaw(`${sdk}:broken-chain`, { prev: "deadbeef" });
  state.sendRaw(broken);
  await withTimeout(nextError(), "broken-chain error");
  actions.push("broken-chain");

  const beforeResume = { ...fresh };
  client.disconnect();
  await sleep(100);
  await client.connect();
  const resumed = await withTimeout(nextConnected(), "same-session resume");
  if (resumed.threadId !== beforeResume.threadId || resumed.sessionId !== beforeResume.sessionId) {
    throw new Error("JavaScript resume changed the session namespace");
  }
  actions.push("same-session-resume");

  client.sendEvent("wp2", { scenario_id: `${sdk}:post-resume`, value: 3 });
  await withTimeout(nextUpdate(), "post-resume acknowledgement");
  actions.push("post-resume");

  client.disconnect();
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify({
    schema_version: 1,
    sdk,
    client_id: clientId,
    protocol_version: "0.3",
    thread_id: resumed.threadId,
    session_id: resumed.sessionId,
    actions,
  }, null, 2)}\n`, "utf8");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

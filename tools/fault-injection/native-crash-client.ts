import WebSocket from "ws";

(globalThis as any).WebSocket = WebSocket;
const {
  generateNonce,
  hashEnvelope,
  LtpClient,
  signMessage,
} = require("../../sdk/js/dist") as Record<string, any>;

const url = process.env.LTP_REFERENCE_URL;
const secretKey = process.env.LTP_REFERENCE_SECRET || "ltp-reference-long-term-secret";
const clientId = "wp3-crash-javascript";

if (!url) throw new Error("LTP_REFERENCE_URL is required");

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function main(): Promise<void> {
  const connected = deferred<{ threadId: string; sessionId: string }>();
  const acknowledged = deferred<unknown>();
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
      onConnected: (threadId: string, sessionId: string) => connected.resolve({ threadId, sessionId }),
      onStateUpdate: (payload: unknown) => acknowledged.resolve(payload),
      onError: (error: unknown) => acknowledged.reject(error),
    },
  );

  await client.connect();
  const ids = await connected.promise;
  const state = client as any;
  const staleClientState = {
    thread_id: state.threadId,
    session_id: state.sessionId,
    last_sent_hash: state.lastSentHash || null,
    last_received_hash: state.lastReceivedHash || null,
  };

  const timestamp = Date.now();
  const nonce = await generateNonce(
    state.options.sessionMacKey,
    clientId,
    timestamp,
    "63726173682d61667465722d73656e64",
  );
  const envelope: any = {
    type: "event",
    thread_id: state.threadId,
    session_id: state.sessionId,
    timestamp,
    nonce,
    payload: {
      event_type: "wp3",
      data: { scenario_id: "wp3:crash-after-send", value: 1 },
    },
    prev_message_hash: state.lastSentHash || undefined,
    meta: { client_id: clientId },
    content_encoding: "json",
  };
  envelope.signature = await signMessage(envelope, state.options.sessionMacKey);
  const committedFrameHash = await hashEnvelope(envelope);

  // Deliberately bypass LtpClient.sendEvent(): send the authenticated frame but
  // do not advance lastSentHash and do not call persistSecurityState().
  state.sendRaw(envelope);
  await acknowledged.promise;

  process.send?.({
    type: "acknowledged",
    process_id: process.pid,
    client_id: clientId,
    thread_id: ids.threadId,
    session_id: ids.sessionId,
    nonce,
    raw_frame: JSON.stringify(envelope),
    committed_frame_hash: committedFrameHash,
    stale_client_state: staleClientState,
  });

  // The parent must SIGKILL this process. Remaining alive proves the exit was
  // not graceful and no sender-side persistence step ran after acknowledgement.
  setInterval(() => undefined, 60_000);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});

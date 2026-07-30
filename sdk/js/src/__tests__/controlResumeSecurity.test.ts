import { LtpClient } from '../client';
import { signMessage } from '../crypto';

class TestStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function run(): Promise<void> {
  const storage = new TestStorage();
  let pongs = 0;
  const client = new LtpClient(
    'ws://example.invalid',
    {
      clientId: 'control-client',
      storage,
      sessionMacKey: 'session-control-key',
      requireSignatureVerification: false,
      heartbeat: { enabled: false, intervalMs: 1000, timeoutMs: 1000 },
    },
    { onPong: () => { pongs += 1; } }
  );
  const state = client as any;
  state.threadId = 'thread-1';
  state.sessionId = 'session-1';
  state.isConnected = true;
  state.isHandshakeComplete = true;
  state.persistIds();

  const timestamp = Date.now();
  const unsignedPong: any = {
    type: 'pong', thread_id: 'thread-1', session_id: 'session-1', timestamp,
    nonce: `hmac-0123456789abcdef0123456789abcdef-${timestamp}`,
    payload: {}, meta: { client_id: 'server' }, content_encoding: 'json',
  };
  await state.handleMessageAsync({ ...unsignedPong });
  assert(pongs === 0, 'unsigned pong must not update liveness');
  assert(state.lastReceivedHash === null, 'unsigned pong must not commit chain state');

  const signedPong = { ...unsignedPong };
  signedPong.signature = await signMessage(signedPong, 'session-control-key');
  await state.handleMessageAsync(signedPong);
  assert(pongs === 1, 'authenticated pong should update liveness');
  const committedHash = state.lastReceivedHash;
  await state.handleMessageAsync(signedPong);
  assert(pongs === 1, 'replayed pong must be rejected');
  assert(state.lastReceivedHash === committedHash, 'replay must not advance the chain');

  state.lastSentHash = 'sent-hash';
  state.persistSecurityState();
  const restored = new LtpClient('ws://example.invalid', {
    clientId: 'control-client', storage, sessionMacKey: 'session-control-key',
    heartbeat: { enabled: false, intervalMs: 1000, timeoutMs: 1000 },
  });
  const restoredState = restored as any;
  assert(restoredState.lastSentHash === 'sent-hash', 'sent chain must restore');
  assert(restoredState.lastReceivedHash === committedHash, 'receive chain must restore');
  assert(restoredState.seenNonces.has(unsignedPong.nonce), 'replay cache must restore');

  await restoredState.handleHandshakeAck({
    type: 'handshake_ack', ltp_version: '0.6', thread_id: 'thread-1', session_id: 'session-1',
    server_capabilities: [], heartbeat_interval_ms: 1000, resumed: true,
  });
  assert(restoredState.lastReceivedHash === committedHash, 'same-session resume must preserve chain');

  await restoredState.handleHandshakeAck({
    type: 'handshake_ack', ltp_version: '0.6', thread_id: 'thread-2', session_id: 'session-2',
    server_capabilities: [], heartbeat_interval_ms: 1000, resumed: false,
  });
  assert(restoredState.lastReceivedHash === null, 'new session must reset receive chain');
  assert(restoredState.seenNonces.size === 0, 'new session must reset replay namespace');
  restored.disconnect();

  const noKey = new LtpClient('ws://example.invalid', {
    clientId: 'no-control-key', heartbeat: { enabled: false, intervalMs: 1000, timeoutMs: 1000 },
  });
  const noKeyState = noKey as any;
  noKeyState.threadId = 'thread'; noKeyState.sessionId = 'session';
  noKeyState.isConnected = true; noKeyState.isHandshakeComplete = true;
  let sent = false;
  noKeyState.ws = { readyState: 1, send: () => { sent = true; } };
  noKey.sendPing();
  await Promise.resolve();
  assert(!sent, 'post-handshake ping without session MAC key must fail closed');

  console.log('✓ control authentication and resume security state (JavaScript)');
}

run().then(() => (process as any).exit(0)).catch((error) => { console.error(error); (process as any).exit(1); });

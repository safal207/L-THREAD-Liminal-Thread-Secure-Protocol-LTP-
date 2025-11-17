const assert = require('node:assert/strict');
const { LtpClient } = require('../dist');

class TestStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, value);
  }
  removeItem(key) {
    this.store.delete(key);
  }
}

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static serverHandler = null;
  static instances = [];
  static sentPayloads = [];

  constructor(url, protocol) {
    this.url = url;
    this.protocol = protocol;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen({});
      }
    }, 0);
  }

  send(data) {
    try {
      MockWebSocket.sentPayloads.push(JSON.parse(data));
    } catch {
      MockWebSocket.sentPayloads.push(data);
    }
    if (MockWebSocket.serverHandler) {
      MockWebSocket.serverHandler(this, data);
    }
  }

  close() {
    if (this.readyState === MockWebSocket.CLOSED) {
      return;
    }
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({});
    }
  }

  emitFromServer(payload) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(payload) });
    }
  }

  static reset() {
    MockWebSocket.instances = [];
    MockWebSocket.serverHandler = null;
    MockWebSocket.sentPayloads = [];
  }
}

global.WebSocket = MockWebSocket;

function createAck(threadId, sessionId, resumed = false) {
  return {
    type: 'handshake_ack',
    ltp_version: '0.3',
    thread_id: threadId,
    session_id: sessionId,
    server_capabilities: ['basic-state-update', 'ping-pong', 'events'],
    heartbeat_interval_ms: 10,
    resumed,
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs = 500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return true;
    }
    await wait(10);
  }
  return false;
}

function resetMocks() {
  MockWebSocket.reset();
}

async function testHandshakeInitPersists() {
  resetMocks();
  const storage = new TestStorage();
  MockWebSocket.serverHandler = (socket, data) => {
    const parsed = JSON.parse(data);
    if (parsed.type === 'handshake_init') {
      socket.emitFromServer(createAck('thread-init', 'session-1'));
    }
  };

  const client = new LtpClient('ws://localhost:8080', { clientId: 'test-client', storage });
  await client.connect();
  assert.equal(client.getThreadId(), 'thread-init');
  assert.equal(storage.getItem('ltp_thread_id:test-client'), 'thread-init');
  assert.equal(storage.getItem('ltp_session_id:test-client'), 'session-1');
  client.disconnect();
}

async function testHandshakeResume() {
  resetMocks();
  const storage = new TestStorage();
  storage.setItem('ltp_thread_id:test-client', 'thread-existing');

  MockWebSocket.serverHandler = (socket, data) => {
    const parsed = JSON.parse(data);
    if (parsed.type === 'handshake_resume') {
      assert.equal(parsed.thread_id, 'thread-existing');
      socket.emitFromServer(createAck('thread-existing', 'session-2', true));
    }
  };

  const client = new LtpClient('ws://localhost:8080', { clientId: 'test-client', storage });
  await client.connect();
  assert.equal(client.getThreadId(), 'thread-existing');
  assert.equal(client.getSessionId(), 'session-2');
  client.disconnect();
}

async function testResumeFallback() {
  resetMocks();
  const storage = new TestStorage();
  storage.setItem('ltp_thread_id:test-client', 'stale-thread');
  let initHandled = false;

  MockWebSocket.serverHandler = (socket, data) => {
    const parsed = JSON.parse(data);
    if (parsed.type === 'handshake_resume') {
      socket.emitFromServer({
        type: 'handshake_reject',
        ltp_version: '0.2',
        reason: 'thread_not_found',
        suggest_new: true,
      });
    }
    if (parsed.type === 'handshake_init' && !initHandled) {
      initHandled = true;
      socket.emitFromServer(createAck('new-thread', 'session-new'));
    }
  };

  const client = new LtpClient('ws://localhost:8080', { clientId: 'test-client', storage });
  await client.connect();
  assert.equal(client.getThreadId(), 'new-thread');
  client.disconnect();
}

async function testHeartbeatReconnect() {
  resetMocks();
  const storage = new TestStorage();
  MockWebSocket.serverHandler = (socket, data) => {
    const parsed = JSON.parse(data);
    if (parsed.type === 'handshake_init') {
      socket.emitFromServer(createAck('thread-heartbeat', 'session-hb'));
    }
  };

  const client = new LtpClient('ws://localhost:8080', {
    clientId: 'hb-client',
    storage,
    heartbeat: { intervalMs: 5, timeoutMs: 15 },
    reconnect: { baseDelayMs: 5, maxDelayMs: 10, maxRetries: 2 },
  });

  await client.connect();
  await wait(20);
  const pingSent = MockWebSocket.sentPayloads.some(
    (payload) => payload && typeof payload === 'object' && payload.type === 'ping'
  );
  assert.equal(pingSent, true);

  const resumed = await waitFor(() =>
    MockWebSocket.sentPayloads.filter(
      (payload) => payload && typeof payload === 'object'
    ).some((payload) => payload.type === 'handshake_resume')
  );
  assert.equal(resumed, true);
  client.disconnect();
}

async function testReconnectBackoff() {
  resetMocks();
  const storage = new TestStorage();
  MockWebSocket.serverHandler = (socket, data) => {
    const parsed = JSON.parse(data);
    if (parsed.type === 'handshake_init') {
      socket.emitFromServer(createAck('thread-retry', 'session-1'));
    } else if (parsed.type === 'handshake_resume') {
      socket.close();
    }
  };

  const client = new LtpClient('ws://localhost:8080', {
    clientId: 'retry-client',
    storage,
    reconnect: { baseDelayMs: 5, maxDelayMs: 50, maxRetries: 4 },
    heartbeat: { enabled: false },
  });

  await client.connect();
  const first = MockWebSocket.instances[0];
  first.close();
  assert.equal(client.getLastReconnectDelayMs(), 5);

  await wait(10);
  const second = MockWebSocket.instances[1];
  second.close();
  assert.equal(client.getLastReconnectDelayMs(), 10);

  await wait(20);
  assert.ok(MockWebSocket.instances.length >= 3);
  client.disconnect();
}

const tests = [
  ['handshake_init persists identifiers in storage', testHandshakeInitPersists],
  ['handshake_resume reuses stored thread_id', testHandshakeResume],
  ['resume rejection falls back to handshake_init', testResumeFallback],
  ['heartbeat sends ping and triggers reconnect when pong missing', testHeartbeatReconnect],
  ['reconnect uses exponential backoff', testReconnectBackoff],
];

(async () => {
  for (const [name, fn] of tests) {
    try {
      console.log(`→ ${name}`);
      await fn();
      console.log(`✔ ${name}`);
    } catch (error) {
      console.error(`✖ ${name}`);
      console.error(error);
      process.exitCode = 1;
      break;
    }
  }
})();

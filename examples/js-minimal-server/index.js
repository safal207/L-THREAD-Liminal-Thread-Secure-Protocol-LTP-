/**
 * LTP Minimal Server Example
 * Demonstrates basic LTP server implementation
 */

const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');

const PORT = 8080;
const LTP_VERSION = '0.2';
const THREAD_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Connection-level session store
const sessions = new Map();
// Thread continuity store
const threads = new Map();

function attachSecurity(envelope) {
  return {
    ...envelope,
    nonce: `server-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    signature: 'v0-server-placeholder',
  };
}

function createHandshakeAck(threadId, sessionId, resumed = false) {
  return {
    type: 'handshake_ack',
    ltp_version: LTP_VERSION,
    thread_id: threadId,
    session_id: sessionId,
    server_capabilities: ['basic-state-update', 'ping-pong', 'events'],
    heartbeat_interval_ms: 15000,
    resumed,
    metadata: {
      server_version: '0.2.0',
      region: 'local',
    },
  };
}

function createThreadState(clientMessage) {
  const threadId = uuidv4();
  const sessionId = uuidv4();
  const state = {
    threadId,
    lastSessionId: sessionId,
    clientId: clientMessage.client_id,
    lastSeen: Date.now(),
    contextTag: clientMessage.intent,
    affect: null,
  };
  threads.set(threadId, state);
  return { threadId, sessionId, state };
}

function resumeThread(threadId, clientId) {
  const state = threads.get(threadId);
  if (!state) {
    return null;
  }
  state.lastSeen = Date.now();
  state.clientId = clientId;
  const sessionId = uuidv4();
  state.lastSessionId = sessionId;
  return { state, sessionId };
}

function sendHandshakeReject(ws, reason) {
  ws.send(
    JSON.stringify({
      type: 'handshake_reject',
      ltp_version: LTP_VERSION,
      reason,
      suggest_new: true,
    })
  );
}

function updateThreadStateFromMessage(message) {
  const state = threads.get(message.thread_id);
  if (!state) {
    return;
  }
  state.lastSeen = Date.now();
  state.lastSessionId = message.session_id;
  if (message.meta?.context_tag) {
    state.contextTag = message.meta.context_tag;
  }
  if (message.meta?.affect) {
    state.affect = message.meta.affect;
  }
}

function createPongMessage(pingMessage) {
  return attachSecurity({
    type: 'pong',
    thread_id: pingMessage.thread_id,
    session_id: pingMessage.session_id,
    timestamp: Math.floor(Date.now() / 1000),
    payload: {},
    meta: {},
  });
}

function createErrorMessage(errorCode, errorMessage, details = {}) {
  return {
    type: 'error',
    timestamp: Math.floor(Date.now() / 1000),
    payload: {
      error_code: errorCode,
      error_message: errorMessage,
      details,
    },
  };
}

function handleHandshakeInit(ws, message) {
  console.log('← Received handshake_init from client:', message.client_id);
  const { threadId, sessionId } = createThreadState(message);
  sessions.set(ws, {
    threadId,
    sessionId,
    clientId: message.client_id,
  });
  ws.send(JSON.stringify(createHandshakeAck(threadId, sessionId, false)));
  console.log('→ Sent handshake_ack (new thread)');
}

function handleHandshakeResume(ws, message) {
  console.log('← Received handshake_resume attempt:', message.thread_id);
  const resumed = resumeThread(message.thread_id, message.client_id);
  if (!resumed) {
    console.log('  Thread not found, rejecting resume');
    sendHandshakeReject(ws, 'thread_not_found');
    return;
  }

  sessions.set(ws, {
    threadId: message.thread_id,
    sessionId: resumed.sessionId,
    clientId: message.client_id,
  });
  ws.send(JSON.stringify(createHandshakeAck(message.thread_id, resumed.sessionId, true)));
  console.log('→ Resumed existing thread');
}

function handleMessage(ws, message, sessionData) {
  const { type } = message;

  switch (type) {
    case 'handshake_init':
      handleHandshakeInit(ws, message);
      break;

    case 'handshake_resume':
      handleHandshakeResume(ws, message);
      break;

    case 'ping':
      console.log('← Received ping');
      const pong = createPongMessage(message);
      ws.send(JSON.stringify(pong));
      console.log('→ Sent pong\n');
      break;

    case 'state_update':
      updateThreadStateFromMessage(message);
      // Compact LTP+LRI logging format
      const threadShort = message.thread_id ? message.thread_id.substring(0, 8) : 'none';
      const sessionShort = message.session_id ? message.session_id.substring(0, 8) : 'none';
      const contextTag = message.meta?.context_tag || 'none';
      const affectStr = message.meta?.affect
        ? `valence=${message.meta.affect.valence},arousal=${message.meta.affect.arousal}`
        : 'none';
      const intent = message.payload?.data?.intent || 'none';

      console.log(`← [LTP] state_update`);
      console.log(`  LTP[${threadShort}/${sessionShort}] ctx=${contextTag} affect={${affectStr}} intent=${intent}`);

      // Detailed payload logging
      console.log('  Kind:', message.payload.kind);
      if (message.payload.kind === 'lri_envelope_v1') {
        console.log('  [LRI] Processing semantic content:');
        if (message.payload.data?.summary) {
          console.log('    Summary:', message.payload.data.summary);
        }
        if (message.payload.data?.inner_state) {
          console.log('    Inner state:', JSON.stringify(message.payload.data.inner_state));
        }
        if (message.payload.data?.resonance_hooks) {
          console.log('    Resonance hooks:', message.payload.data.resonance_hooks.join(', '));
        }
      } else {
        console.log('  Data:', JSON.stringify(message.payload.data, null, 2));
      }

      // Log LRI-enhanced format (LTP + LRI integration)
      const threadShort = message.thread_id.substring(0, 8);
      const sessionShort = message.session_id.substring(0, 8);
      const contextTag = message.meta?.context_tag || 'none';
      const affect = message.meta?.affect;
      const intent = message.payload?.data?.intent || 'none';

      let ltpLog = `LTP[${threadShort}.../${sessionShort}...] ctx=${contextTag}`;

      if (affect) {
        ltpLog += ` affect={${affect.valence},${affect.arousal}}`;
      }

      ltpLog += ` intent=${intent}`;

      console.log(`  ${ltpLog}`);

      // Echo back a server state update (optional)
      const serverStateUpdate = attachSecurity({
        type: 'state_update',
        thread_id: message.thread_id,
        session_id: message.session_id,
        timestamp: Math.floor(Date.now() / 1000),
        payload: {
          kind: 'delta',
          data: {
            lri_resonance: 0.92,
            server_status: 'processing',
          },
        },
        meta: {},
      });
      ws.send(JSON.stringify(serverStateUpdate));
      console.log('→ Sent server state update\n');
      break;

    case 'event':
      console.log('← Received event:');
      console.log('  Thread ID:', message.thread_id);
      console.log('  Session ID:', message.session_id);
      console.log('  Event Type:', message.payload.event_type);
      console.log('  Data:', JSON.stringify(message.payload.data, null, 2));

      // Log liminal metadata if present
      if (message.meta) {
        if (message.meta.affect) {
          console.log('  Affect:');
          console.log('    Valence:', message.meta.affect.valence);
          console.log('    Arousal:', message.meta.affect.arousal);
        }
        if (message.meta.context_tag) {
          console.log('  Context Tag:', message.meta.context_tag);
        }
      }

      // Send an acknowledgment event
      const ackEvent = attachSecurity({
        type: 'event',
        thread_id: message.thread_id,
        session_id: message.session_id,
        timestamp: Math.floor(Date.now() / 1000),
        payload: {
          event_type: 'event_received',
          data: {
            original_event: message.payload.event_type,
            status: 'acknowledged',
          },
        },
        meta: {},
      });
      ws.send(JSON.stringify(ackEvent));
      console.log('→ Sent acknowledgment event\n');
      break;

    default:
      console.log('← Received unknown message type:', type);
      const error = createErrorMessage(
        'UNKNOWN_MESSAGE_TYPE',
        `Message type '${type}' is not supported`,
        { received_type: type }
      );
      ws.send(JSON.stringify(error));
      break;
  }
}

function startServer() {
  const wss = new WebSocketServer({
    port: PORT,
    handleProtocols: (protocols, request) => {
      // Accept ltp.v0.2 subprotocol
      // protocols can be a Set or Array depending on ws version
      const protocolList = Array.isArray(protocols) ? protocols : Array.from(protocols);
      if (protocolList.includes('ltp.v0.2')) {
        return 'ltp.v0.2';
      }
      return false;
    }
  });

  console.log('=== LTP Minimal Server ===\n');
  console.log(`✓ LTP server listening on ws://localhost:${PORT}`);
  console.log('  Protocol: LTP v0.2');
  console.log('  Waiting for connections...\n');

  wss.on('connection', (ws, request) => {
    console.log('✓ New WebSocket connection established');
    console.log(`  Remote: ${request.socket.remoteAddress}\n`);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        const sessionData = sessions.get(ws);
        handleMessage(ws, message, sessionData);
      } catch (error) {
        console.error('✗ Failed to parse message:', error.message);
        const errorMsg = createErrorMessage(
          'MALFORMED_MESSAGE',
          'Invalid JSON or message structure',
          { error: error.message }
        );
        ws.send(JSON.stringify(errorMsg));
      }
    });

    ws.on('close', () => {
      const sessionData = sessions.get(ws);
      if (sessionData) {
        console.log('✗ Client disconnected');
        console.log(`  Client ID: ${sessionData.clientId}`);
        console.log(`  Thread ID: ${sessionData.threadId}\n`);
        sessions.delete(ws);
      }
    });

    ws.on('error', (error) => {
      console.error('✗ WebSocket error:', error.message);
    });
  });

  wss.on('error', (error) => {
    console.error('✗ Server error:', error);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nShutting down LTP server...');
    wss.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

setInterval(() => {
  const cutoff = Date.now() - THREAD_TTL_MS;
  for (const [threadId, state] of threads.entries()) {
    if (state.lastSeen < cutoff) {
      threads.delete(threadId);
      console.log(`🧹 Removed inactive thread ${threadId}`);
    }
  }
}, 60 * 1000);

startServer();

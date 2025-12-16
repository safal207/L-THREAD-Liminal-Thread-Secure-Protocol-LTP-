
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { LtpClient } from '../src/client';

describe('LTP Silence as Signal', () => {
  let wss: WebSocketServer;
  let client: LtpClient;
  let port: number;

  beforeEach(async () => {
    // Setup minimal WS server
    port = 5000 + Math.floor(Math.random() * 1000);
    wss = new WebSocketServer({ port });

    // Server logic: handshake and then SILENCE
    wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'handshake_init') {
          ws.send(JSON.stringify({
            type: 'handshake_ack',
            thread_id: 't-123',
            session_id: 's-123',
            heartbeat_interval_ms: 10000,
            payload: {},
          }));
          // After this, the server intentionally sends nothing
        }
      });
    });

    client = new LtpClient(`ws://localhost:${port}`, {
      clientId: 'silence-test-client',
      heartbeat: { enabled: false } // Disable client pings to reduce noise
    });

    await new Promise<void>((resolve) => wss.on('listening', resolve));
  });

  afterEach(() => {
    client.disconnect();
    wss.close();
  });

  it('client should not emit errors or generate traffic when server is silent', async () => {
    let messageCount = 0;
    let errorCount = 0;

    // Use internal event hooks if available or mock logger?
    // The public API has onMessage events.
    const events = {
        onMessage: () => { messageCount++; },
        onError: () => { errorCount++; }
    };

    // Re-instantiate with events
    client = new LtpClient(`ws://localhost:${port}`, {
        clientId: 'silence-test-client',
        heartbeat: { enabled: false }
    }, events);

    await client.connect();

    // The handshake_ack counts as one message
    expect(messageCount).toBe(1);

    // Wait for silence duration (e.g., 200ms)
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Should receive nothing else
    expect(messageCount).toBe(1);
    expect(errorCount).toBe(0);
  });
});

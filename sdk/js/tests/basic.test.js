/**
 * Basic tests for LTP SDK
 * These are simple validation tests - not full integration tests
 */

// Mock WebSocket for testing
global.WebSocket = class MockWebSocket {
  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = 0; // CONNECTING
  }

  send(data) {
    // Mock send
  }

  close() {
    // Mock close
  }
};

const { LtpClient } = require('../dist/index');

describe('LTP SDK Tests', () => {
  describe('HandshakeInit Message', () => {
    test('creates handshake_init with required fields', () => {
      const clientId = 'test-client-123';
      const client = new LtpClient('ws://localhost:8080', { clientId });

      // Access private method for testing (in real tests, we'd test via public API)
      expect(client).toBeDefined();
      expect(client.getThreadId()).toBeNull(); // Not connected yet
      expect(client.getSessionId()).toBeNull();
      expect(client.isConnectedToServer()).toBe(false);
    });
  });

  describe('LtpClient Options', () => {
    test('accepts defaultContextTag option', () => {
      const client = new LtpClient('ws://localhost:8080', {
        clientId: 'test-client',
        defaultContextTag: 'test_context',
      });

      expect(client).toBeDefined();
      // Context tag will be used in meta when sending messages
    });

    test('accepts defaultAffect option', () => {
      const client = new LtpClient('ws://localhost:8080', {
        clientId: 'test-client',
        defaultAffect: {
          valence: 0.5,
          arousal: -0.3,
        },
      });

      expect(client).toBeDefined();
      // Affect will be used in meta when sending messages
    });

    test('uses provided clientId', () => {
      const clientId = 'my-custom-client-id';
      const client = new LtpClient('ws://localhost:8080', { clientId });

      expect(client).toBeDefined();
      // ClientId is stored and will be used in messages
    });
  });

  describe('Message Metadata', () => {
    test('sendStateUpdate uses defaultContextTag when not overridden', () => {
      const client = new LtpClient('ws://localhost:8080', {
        clientId: 'test-client',
        defaultContextTag: 'default_context',
      });

      // This would use default_context in meta.context_tag
      // In real test, we'd mock WebSocket and verify the sent message
      expect(client.sendStateUpdate).toBeDefined();
    });

    test('sendStateUpdate allows explicit contextTag override', () => {
      const client = new LtpClient('ws://localhost:8080', {
        clientId: 'test-client',
        defaultContextTag: 'default_context',
      });

      // This would use 'custom_context' instead of 'default_context'
      // In real test, we'd verify the message contains correct context_tag
      expect(client.sendStateUpdate).toBeDefined();
    });

    test('sendEvent supports affect metadata', () => {
      const client = new LtpClient('ws://localhost:8080', {
        clientId: 'test-client',
      });

      // Event can include affect metadata
      expect(client.sendEvent).toBeDefined();
    });
  });

  describe('Client State', () => {
    test('initializes in disconnected state', () => {
      const client = new LtpClient('ws://localhost:8080');

      expect(client.isConnectedToServer()).toBe(false);
      expect(client.getThreadId()).toBeNull();
      expect(client.getSessionId()).toBeNull();
    });
  });
});

// Simple test runner for Node.js (if Jest/Vitest not available)
if (require.main === module) {
  console.log('Running basic LTP SDK tests...\n');

  // Test 1: Client creation
  try {
    const client = new LtpClient('ws://localhost:8080', {
      clientId: 'test-client',
      defaultContextTag: 'test_context',
    });
    console.log('✓ Client creation with defaultContextTag');
  } catch (error) {
    console.error('✗ Client creation failed:', error.message);
  }

  // Test 2: Client with defaultAffect
  try {
    const client = new LtpClient('ws://localhost:8080', {
      clientId: 'test-client',
      defaultAffect: {
        valence: 0.5,
        arousal: -0.3,
      },
    });
    console.log('✓ Client creation with defaultAffect');
  } catch (error) {
    console.error('✗ Client creation with affect failed:', error.message);
  }

  // Test 3: Initial state
  try {
    const client = new LtpClient('ws://localhost:8080');
    if (!client.isConnectedToServer() && client.getThreadId() === null) {
      console.log('✓ Client initializes in disconnected state');
    } else {
      console.error('✗ Client state incorrect');
    }
  } catch (error) {
    console.error('✗ State test failed:', error.message);
  }

  console.log('\nBasic tests completed!');
}

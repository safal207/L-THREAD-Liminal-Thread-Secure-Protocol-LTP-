/**
 * LTP Minimal Client Example
 * Demonstrates basic usage of the LTP client SDK
 */

const { LtpClient } = require('../../sdk/js/dist/index');

/**
 * Send evening reflection sample - demonstrates LTP+LRI integration
 * This shows how semantic LRI data flows through LTP transport layer
 */
function sendEveningReflectionSample(client) {
  console.log('→ Sending evening reflection (LTP+LRI example)...');

  // This uses the LTP client's sendMessage method with custom meta fields
  // The client will automatically add type, thread_id, session_id, timestamp
  client.sendMessage({
    type: 'state_update',
    meta: {
      // LRI-specific meta fields
      affect: {
        valence: 0.2,   // slightly positive
        arousal: -0.3   // low energy
      },
      context_tag: 'evening_reflection'
    },
    payload: {
      kind: 'lri_envelope_v1',
      data: {
        actor: 'user:self',
        intent: 'reflect_on_day',
        summary: 'Slightly tired, but feeling a sense of quiet progress.',
        highlights: [
          'played with kids',
          'advanced LTP protocol',
          'less anxiety about the future'
        ],
        inner_state: {
          energy: 0.4,
          clarity: 0.7,
          stress: 0.3
        },
        resonance_hooks: [
          'family',
          'creator_path',
          'long_horizon'
        ]
      }
    }
  });

  console.log('  ✓ Evening reflection sent (see spec section 9 for details)\n');
}

async function main() {
  console.log('=== LTP Minimal Client Example ===\n');

  // Create LTP client
  const client = new LtpClient(
    'ws://localhost:8080',
    {
      clientId: 'example-client-001',
      deviceFingerprint: 'node-example',
      intent: 'resonant_link',
      capabilities: ['state-update', 'events', 'ping-pong'],
      metadata: {
        example: true,
        version: '1.0.0',
      },
    },
    {
      // Event handlers
      onConnected: (threadId, sessionId) => {
        console.log('✓ Connected to LTP server');
        console.log(`  Thread ID:  ${threadId}`);
        console.log(`  Session ID: ${sessionId}\n`);

        // Send initial state update
        console.log('→ Sending initial state update...');
        client.sendStateUpdate({
          kind: 'minimal',
          data: {
            mood: 'curious',
            focus: 'exploration',
            energy_level: 0.8,
          },
        });

        // Send evening reflection sample after 1 second
        setTimeout(() => {
          sendEveningReflectionSample(client);
        }, 1000);

        // Send a test event after 2 seconds
        setTimeout(() => {
          console.log('→ Sending test event...');
          client.sendEvent('user_action', {
            action: 'button_click',
            target: 'explore_mode',
            screen: 'home',
          });
        }, 2000);

        // Send another state update after 4 seconds
        setTimeout(() => {
          console.log('→ Sending state update...');
          client.sendStateUpdate({
            kind: 'delta',
            data: {
              focus: 'learning',
              energy_level: 0.9,
            },
          });
        }, 4000);

        // Disconnect after 10 seconds
        setTimeout(() => {
          console.log('\n→ Disconnecting...');
          client.disconnect();
          process.exit(0);
        }, 10000);
      },

      onDisconnected: () => {
        console.log('✗ Disconnected from LTP server\n');
      },

      onError: (error) => {
        console.error('✗ Server error:', error.error_code, '-', error.error_message);
        if (error.details) {
          console.error('  Details:', error.details);
        }
      },

      onStateUpdate: (payload) => {
        console.log('← Received state update from server:');
        console.log('  ', JSON.stringify(payload, null, 2));
      },

      onEvent: (payload) => {
        console.log('← Received event from server:');
        console.log('  ', JSON.stringify(payload, null, 2));
      },

      onPong: () => {
        console.log('← Received pong (heartbeat)');
      },

      onMessage: (message) => {
        // Uncomment to see all raw messages
        // console.log('← Message:', message.type);
      },
    }
  );

  // Connect to server
  try {
    console.log('Connecting to LTP server at ws://localhost:8080...\n');
    await client.connect();
  } catch (error) {
    console.error('Failed to connect:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);

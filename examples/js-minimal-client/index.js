/**
 * LTP Minimal Client Example
 * Demonstrates basic usage of the LTP client SDK
 */

const { LtpClient } = require('../../sdk/js/dist/index');

/**
 * Send evening reflection sample - demonstrates LTP + LRI integration
 * This shows how a real-world "evening reflection" scenario would flow through the protocol
 */
function sendEveningReflectionSample(client) {
  client.sendStateUpdate(
    {
      kind: 'lri_envelope_v1',
      data: {
        actor: 'user:self',
        intent: 'reflect_on_day',
        summary: 'Slightly tired, but there\'s a sense of quiet progress.',
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
    },
    {
      affect: {
        valence: 0.2,   // Slightly positive
        arousal: -0.3   // Calm/relaxed
      },
      contextTag: 'evening_reflection'
    }
  );
}

async function main() {
  console.log('=== LTP Minimal Client Example ===\n');

  // Create LTP client with default context tag
  const client = new LtpClient(
    'ws://localhost:8080',
    {
      clientId: 'example-client-001',
      deviceFingerprint: 'node-example',
      intent: 'resonant_link',
      capabilities: ['state-update', 'events', 'ping-pong'],
      defaultContextTag: 'dev_playground',  // Default context for all messages
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

        // Send initial state update with affect metadata
        console.log('→ Sending initial state update with affect...');
        client.sendStateUpdate(
          {
            kind: 'minimal',
            data: {
              mood: 'curious',
              focus: 'exploration',
              energy_level: 0.8,
            },
          },
          {
            affect: {
              valence: 0.2,   // Slightly positive
              arousal: -0.1   // Slightly calm
            }
          }
        );

        // Send a test event with explicit context tag after 2 seconds
        setTimeout(() => {
          console.log('→ Sending test event with context_tag...');
          client.sendEvent(
            'user_action',
            {
              action: 'button_click',
              target: 'explore_mode',
              screen: 'home',
            },
            {
              contextTag: 'focus_session'  // Override default context
            }
          );
        }, 2000);

        // Send another state update (will use default context_tag) after 4 seconds
        setTimeout(() => {
          console.log('→ Sending state update (with default context_tag)...');
          client.sendStateUpdate({
            kind: 'delta',
            data: {
              focus: 'learning',
              energy_level: 0.9,
            },
          });
        }, 4000);

        // Send evening reflection example after 6 seconds
        setTimeout(() => {
          console.log('\n→ Sending evening reflection (LRI-aware)...');
          sendEveningReflectionSample(client);
        }, 6000);

        // Disconnect after 12 seconds
        setTimeout(() => {
          console.log('\n→ Disconnecting...');
          client.disconnect();
          process.exit(0);
        }, 12000);
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

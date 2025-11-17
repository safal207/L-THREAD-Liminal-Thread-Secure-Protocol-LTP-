/**
 * LTP Minimal Client Example
 * Demonstrates basic usage of the LTP client SDK
 */

const { LtpClient } = require('../../sdk/js/dist/index');
const { simpleToonCodec } = require('../shared/simpleToonCodec');

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

function sendEveningReflectionToonLog(client) {
  console.log('→ Sending affect log using TOON encoding...');

  const affectLog = [
    { t: 1, valence: 0.2, arousal: -0.1 },
    { t: 2, valence: 0.3, arousal: -0.2 },
    { t: 3, valence: 0.1, arousal: 0.0 },
  ];

  client.sendStateUpdate({
    kind: 'affect_log_v1',
    data: affectLog,
  });

  console.log('  ✓ Affect log queued for TOON encoding by client\n');
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
      codec: simpleToonCodec,
      preferredEncoding: 'toon',
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

        // Send evening reflection sample after 1 second
        setTimeout(() => {
          sendEveningReflectionSample(client);
        }, 1000);

        // Send a test event after 2 seconds
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

        setTimeout(() => {
          console.log('→ Sending TOON affect log (compact payload)...');
          sendEveningReflectionToonLog(client);
        }, 8000);

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

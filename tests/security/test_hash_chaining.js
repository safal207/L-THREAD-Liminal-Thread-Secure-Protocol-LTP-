#!/usr/bin/env node
/**
 * Test Hash Chaining
 * Verifies that all SDKs can create and verify hash chains correctly
 */

const { execSync } = require('child_process');
const path = require('path');
const assert = require('assert');

let crypto;
try {
  crypto = require('../../sdk/js/dist/index');
} catch (e) {
  console.error('Could not load JS SDK from dist/index.js.');
  console.error('Please run "cd sdk/js && npm install && npm run build" first.');
  process.exit(1);
}

const PYTHON_CLI = path.join(__dirname, 'hash_chaining_cli.py');

function runPython(args) {
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const cmd = `${pythonCmd} "${PYTHON_CLI}" ${args}`;
  try {
    const output = execSync(cmd, { encoding: 'utf8' });
    return JSON.parse(output.trim());
  } catch (e) {
    console.error(`Python script failed: ${cmd}`);
    console.error(e.stdout);
    console.error(e.stderr);
    throw e;
  }
}

async function testHashChaining() {
  console.log('Testing Hash Chaining (JS <-> Python)...\n');

  // 1. Create first message (no prev_message_hash)
  console.log('  [JS] Creating first message...');
  const message1 = {
    type: 'state_update',
    thread_id: 'thread-123',
    session_id: 'session-456',
    timestamp: Date.now(),
    payload: { kind: 'minimal', data: { value: 1 } }
  };

  const hash1 = await crypto.hashEnvelope(message1);
  console.log(`  Hash 1: ${hash1.substring(0, 32)}...\n`);

  // 2. Create second message with prev_message_hash
  console.log('  [JS] Creating second message with hash chain...');
  const message2 = {
    ...message1,
    timestamp: message1.timestamp + 1000,
    prev_message_hash: hash1,
    payload: { kind: 'minimal', data: { value: 2 } }
  };

  const hash2 = await crypto.hashEnvelope(message2);
  console.log(`  Hash 2: ${hash2.substring(0, 32)}...\n`);

  // 3. Verify hash chain in JS
  console.log('  [JS] Verifying hash chain...');
  const hash2Recalculated = await crypto.hashEnvelope(message2);
  assert(hash2 === hash2Recalculated, 'Hash should be deterministic');
  assert(hash2 !== hash1, 'Different messages should have different hashes');
  console.log('  ✅ Hash chain verification passed\n');

  // 4. Create message in Python
  console.log('  [Python] Creating message...');
  const pyMessage = {
    type: 'state_update',
    thread_id: 'thread-123',
    session_id: 'session-456',
    timestamp: message1.timestamp + 2000,
    prev_message_hash: hash2,
    payload: { kind: 'minimal', data: { value: 3 } }
  };

  const pyHash = runPython(`hash ${JSON.stringify(pyMessage)}`);
  console.log(`  Python Hash: ${pyHash.hash.substring(0, 32)}...\n`);

  // 5. Verify Python hash in JS (cross-SDK)
  console.log('  [JS] Verifying Python-generated hash...');
  const jsHashForPyMessage = await crypto.hashEnvelope(pyMessage);
  assert(jsHashForPyMessage === pyHash.hash, 'Cross-SDK hash should match');
  console.log('  ✅ Cross-SDK (Python→JS) hash verification passed\n');

  // 6. Verify JS hash in Python (cross-SDK)
  console.log('  [Python] Verifying JS-generated hash...');
  const pyHashForJsMessage = runPython(`hash ${JSON.stringify(message2)}`);
  assert(pyHashForJsMessage.hash === hash2, 'Cross-SDK (JS→Python) hash should match');
  console.log('  ✅ Cross-SDK (JS→Python) hash verification passed\n');

  // 7. Test tampering detection
  console.log('  [JS] Testing tampering detection...');
  const tamperedMessage = {
    ...message2,
    payload: { kind: 'minimal', data: { value: 999 } } // Tampered!
  };
  const tamperedHash = await crypto.hashEnvelope(tamperedMessage);
  assert(tamperedHash !== hash2, 'Tampered message should have different hash');
  console.log('  ✅ Tampering detection works\n');

  // 8. Test that prev_message_hash affects hash
  console.log('  [JS] Testing prev_message_hash impact...');
  const messageWithoutPrev = {
    ...message2,
    prev_message_hash: undefined
  };
  const hashWithoutPrev = await crypto.hashEnvelope(messageWithoutPrev);
  assert(hashWithoutPrev !== hash2, 'Message without prev_message_hash should have different hash');
  console.log('  ✅ prev_message_hash correctly affects hash\n');

  console.log('✅ All hash chaining tests passed!');
}

testHashChaining().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});


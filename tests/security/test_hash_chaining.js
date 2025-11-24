#!/usr/bin/env node
/**
 * Test Hash Chaining
 * Verifies that all SDKs can create and verify hash chains correctly
 */

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { serializeCanonical } = require('../../sdk/js/dist/crypto');

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
    payload: { kind: 'minimal', data: { value: 2 } },
    nonce: '',
    meta: {},
    content_encoding: ''
  };
  const jsMessage2 = Object.assign({}, message2, {
    nonce: '',
    meta: {},
    content_encoding: ''
  });

  // 5. JS: Получить canonical serialization и bytes до вычисления hash2
  const jsCanonMsg2 = serializeCanonical(message2);
  console.log('[DEBUG][JS:RAW] serializeCanonical(message2):', jsCanonMsg2);
  const jsBytesMsg2 = Buffer.from(jsCanonMsg2, 'utf8');
  console.log('[DEBUG][JS:RAW] bytes(message2):', jsBytesMsg2.toString('hex'));
  // hash2 считается вот так
  const hash2 = await crypto.hashEnvelope(message2);
  // 6. Проверить, что jsMessage2 полностью совпадает по сериялизации с исходником message2 (для runPython)
  const jsCanonMsg2b = serializeCanonical(jsMessage2);
  console.log('[DEBUG][JS:tmpfile] serializeCanonical(jsMessage2):', jsCanonMsg2b);
  const jsBytesMsg2b = Buffer.from(jsCanonMsg2b, 'utf8');
  console.log('[DEBUG][JS:tmpfile] bytes(jsMessage2):', jsBytesMsg2b.toString('hex'));
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
    payload: { kind: 'minimal', data: { value: 3 } },
    nonce: '',
    meta: {},
    content_encoding: ''
  };
  const tmpFile1 = path.join(os.tmpdir(), `py_message_${process.pid}_${Date.now()}.json`);
  fs.writeFileSync(tmpFile1, JSON.stringify(pyMessage));
  const jsCanon1 = serializeCanonical(pyMessage);
  console.log('[DEBUG][JS] serializeCanonical(pyMessage):', jsCanon1);
  const jsBytes1 = Buffer.from(jsCanon1, 'utf8');
  console.log('[DEBUG][JS] bytes pyMessage:', jsBytes1.toString('hex'));
  const pyHash = runPython(`hash ${tmpFile1}`);
  fs.unlinkSync(tmpFile1);
  console.log(`  Python Hash: ${pyHash.hash.substring(0, 32)}...\n`);

  // 5. Verify Python hash in JS (cross-SDK)
  console.log('  [JS] Verifying Python-generated hash...');
  const jsHashForPyMessage = await crypto.hashEnvelope(pyMessage);
  assert(jsHashForPyMessage === pyHash.hash, 'Cross-SDK hash should match');
  console.log('  ✅ Cross-SDK (Python→JS) hash verification passed\n');

  // 6. Verify JS hash in Python (cross-SDK)
  console.log('  [Python] Verifying JS-generated hash...');
  const tmpFile2 = path.join(os.tmpdir(), `js_message_${process.pid}_${Date.now()}.json`);
  fs.writeFileSync(tmpFile2, JSON.stringify(jsMessage2));
  const jsCanon2 = serializeCanonical(jsMessage2);
  console.log('[DEBUG][JS] serializeCanonical(jsMessage2):', jsCanon2);
  const jsBytes2 = Buffer.from(jsCanon2, 'utf8');
  console.log('[DEBUG][JS] bytes jsMessage2:', jsBytes2.toString('hex'));
  const pyHashForJsMessage = runPython(`hash ${tmpFile2}`);
  fs.unlinkSync(tmpFile2);
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

  // --- отладка сериализации для pyMessage (Python check) ---
  const jsCanonicalForPy = await crypto.hashEnvelope(pyMessage); // вернёт хеш, но сами сериализации будем искать ниже
  console.log('  [DEBUG][JS] pyMessage:', pyMessage);
  // ... аналогичная функция есть в crypto.ts: serializeCanonical. Можно вызвать напрямую для отладки или просто скопировать сюда. Здесь важно увидеть, что именно передается! Пока выведем JSON:
  console.log('  [DEBUG][JS] canonical pyMessage:', JSON.stringify(pyMessage));
  // --- аналогично для message2 ---
  console.log('  [DEBUG][JS] message2:', message2);
  console.log('  [DEBUG][JS] canonical message2:', JSON.stringify(message2));

  console.log('✅ All hash chaining tests passed!');
}

testHashChaining().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});


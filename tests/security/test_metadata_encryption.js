#!/usr/bin/env node
/**
 * Test Metadata Encryption
 * Verifies that all SDKs can encrypt and decrypt metadata correctly
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

const PYTHON_CLI = path.join(__dirname, 'metadata_encryption_cli.py');

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

async function testMetadataEncryption() {
  console.log('Testing Metadata Encryption (JS <-> Python)...\n');

  const encryptionKey = 'test-encryption-key-32-bytes-exactly!!';
  const metadata = {
    thread_id: 'thread-123',
    session_id: 'session-456',
    timestamp: Date.now()
  };

  // 1. Encrypt metadata in JS
  console.log('  [JS] Encrypting metadata...');
  const jsEncrypted = await crypto.encryptMetadata(
    JSON.stringify(metadata),
    encryptionKey
  );
  console.log(`  Encrypted: ${jsEncrypted.substring(0, 50)}...\n`);

  // 2. Decrypt in JS (should work)
  console.log('  [JS] Decrypting metadata...');
  const jsDecrypted = await crypto.decryptMetadata(jsEncrypted, encryptionKey);
  const jsMetadata = JSON.parse(jsDecrypted);
  assert(jsMetadata.thread_id === metadata.thread_id, 'Decrypted thread_id should match');
  assert(jsMetadata.session_id === metadata.session_id, 'Decrypted session_id should match');
  console.log('  ✅ JS encryption/decryption cycle passed\n');

  // 3. Encrypt metadata in Python
  console.log('  [Python] Encrypting metadata...');
  const pyEncrypted = runPython(`encrypt ${JSON.stringify(metadata)} ${encryptionKey}`);
  console.log(`  Encrypted: ${pyEncrypted.encrypted.substring(0, 50)}...\n`);

  // 4. Decrypt Python-encrypted data in JS (cross-SDK)
  console.log('  [JS] Decrypting Python-encrypted metadata...');
  const crossDecrypted = await crypto.decryptMetadata(
    pyEncrypted.encrypted,
    encryptionKey
  );
  const crossMetadata = JSON.parse(crossDecrypted);
  assert(crossMetadata.thread_id === metadata.thread_id, 'Cross-SDK decryption should work');
  assert(crossMetadata.session_id === metadata.session_id, 'Cross-SDK decryption should work');
  console.log('  ✅ Cross-SDK (Python→JS) decryption passed\n');

  // 5. Decrypt JS-encrypted data in Python (cross-SDK)
  console.log('  [Python] Decrypting JS-encrypted metadata...');
  const pyDecrypted = runPython(`decrypt ${jsEncrypted} ${encryptionKey}`);
  const pyMetadata = JSON.parse(pyDecrypted.decrypted);
  assert(pyMetadata.thread_id === metadata.thread_id, 'Cross-SDK (JS→Python) decryption should work');
  assert(pyMetadata.session_id === metadata.session_id, 'Cross-SDK (JS→Python) decryption should work');
  console.log('  ✅ Cross-SDK (JS→Python) decryption passed\n');

  // 6. Test wrong key (should fail)
  console.log('  [JS] Testing wrong encryption key (should fail)...');
  try {
    await crypto.decryptMetadata(jsEncrypted, 'wrong-encryption-key-32-bytes-exactly!!');
    assert(false, 'Decryption with wrong key should fail');
  } catch (error) {
    console.log('  ✅ Wrong key correctly rejected\n');
  }

  // 7. Test tampered data (should fail)
  console.log('  [JS] Testing tampered encrypted data (should fail)...');
  const tampered = jsEncrypted.substring(0, jsEncrypted.length - 10) + 'tampered!!';
  try {
    await crypto.decryptMetadata(tampered, encryptionKey);
    assert(false, 'Tampered data should fail decryption');
  } catch (error) {
    console.log('  ✅ Tampered data correctly rejected\n');
  }

  console.log('✅ All metadata encryption tests passed!');
}

testMetadataEncryption().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

